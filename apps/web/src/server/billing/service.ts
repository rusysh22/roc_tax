import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import {
  adminBillingCommandSchema,
  berlangganActivationResponseSchema,
  berlangganWebhookPayloadSchema,
  mapApiStatusToLicenseStatus,
  orgBillingCommandSchema,
  type BerlangganCatalogPlan,
  type LicenseStatus,
} from "../../lib/billing/schemas";
import { identityHint } from "../../lib/intake/identity";
import type { TaxCrypto } from "../intake/crypto";
import { AccessError, type Permission } from "../workspaces/policy";
import { requireActor, requireMembership } from "../workspaces/service";
import {
  BillingProviderError,
  createBerlangganHttpAdapter,
  createSyntheticBillingAdapter,
  type BillingProviderAdapter,
} from "./berlanggan";
import {
  createTestEd25519KeyPair,
  sha256Hex,
  verifyBerlangganEd25519,
  verifyBerlangganWebhookHmac,
} from "./crypto";
import { resolveWorkspaceEntitlements } from "./entitlements";

type Tx = Prisma.TransactionClient;

export class BillingError extends Error {
  constructor(
    public code:
      | "BILLING_NOT_CONFIGURED"
      | "SAAS_LICENSING_UNAPPROVED"
      | "INVALID_WEBHOOK_SIGNATURE"
      | "ENTITLEMENT_SIGNATURE_INVALID"
      | "NOT_FOUND"
      | "INVALID_CONFIGURATION"
      | "SEAT_FULL"
      | "RATE_LIMITED"
      | "LICENSE_INVALID",
  ) {
    super(code);
  }
}

export type BillingServiceOptions = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  adapterOverride?: BillingProviderAdapter;
};

async function lockWorkspace(tx: Tx, organizationId: string) {
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;
}

async function databaseNow(tx: Tx) {
  return (
    await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
  )[0].now;
}

async function requireSuperadmin(tx: Tx, sessionId: string) {
  const session = await requireActor(tx, sessionId);
  if (session.user.platformRole !== "SUPERADMIN") {
    throw new AccessError("FORBIDDEN");
  }
  return session;
}

// Lazy singleton synthetic Ed25519 pair scoped to runtime process for local
// `SYNTHETIC_TEST` test doubles when no custom test key was configured.
let cachedSynthPair: { publicKeyPem: string; privateKeyPem: string } | null =
  null;
function getSyntheticKeyPair() {
  if (!cachedSynthPair) {
    cachedSynthPair = createTestEd25519KeyPair();
  }
  return cachedSynthPair;
}

export function billingService(
  db: PrismaClient,
  taxCrypto: TaxCrypto,
  options: BillingServiceOptions = {},
) {
  const env = options.env ?? process.env;

  async function withActive<T>(
    sessionId: string,
    permission: Permission | undefined,
    fn: (
      tx: Tx,
      actor: Awaited<ReturnType<typeof requireMembership>>,
    ) => Promise<T>,
  ) {
    const initial = await requireActor(db, sessionId);
    if (!initial.activeOrganizationId) throw new AccessError("NO_WORKSPACE");
    const organizationId = initial.activeOrganizationId;
    return db.$transaction(async (tx) => {
      await lockWorkspace(tx, organizationId);
      const actor = await requireMembership(
        tx,
        sessionId,
        organizationId,
        permission,
      );
      if (actor.session.activeOrganizationId !== organizationId) {
        throw new AccessError("CONFLICT");
      }
      return fn(tx, actor);
    });
  }

  function resolveAdapter(config: {
    adapterMode: "NOT_CONFIGURED" | "SYNTHETIC_TEST" | "BERLANGGAN_LIVE";
    apiBaseUrl: string | null;
    productSecretRef: string | null;
    ed25519PublicKey: string | null;
  }): { adapter: BillingProviderAdapter; publicKey: string | null } {
    if (options.adapterOverride) {
      return {
        adapter: options.adapterOverride,
        publicKey: config.ed25519PublicKey,
      };
    }
    if (config.adapterMode === "SYNTHETIC_TEST") {
      const pair = getSyntheticKeyPair();
      return {
        adapter: createSyntheticBillingAdapter(pair.privateKeyPem),
        publicKey: config.ed25519PublicKey || pair.publicKeyPem,
      };
    }
    if (config.adapterMode === "BERLANGGAN_LIVE" && config.apiBaseUrl) {
      const secret = config.productSecretRef
        ? (env[config.productSecretRef] ?? null)
        : null;
      return {
        adapter: createBerlangganHttpAdapter({
          apiBaseUrl: config.apiBaseUrl,
          productSecret: secret,
          fetchImpl: options.fetchImpl,
        }),
        publicKey: config.ed25519PublicKey,
      };
    }
    throw new BillingError("BILLING_NOT_CONFIGURED");
  }

  async function listAdminBilling(sessionId: string) {
    return db.$transaction(async (tx) => {
      await requireSuperadmin(tx, sessionId);
      const config = await tx.billingConfig.findUnique({
        where: { id: "default" },
      });
      const events = await tx.billingWebhookEvent.findMany({
        orderBy: { receivedAt: "desc" },
        take: 25,
      });
      const [totalEvents, validEvents, rejectedEvents] = await Promise.all([
        tx.billingWebhookEvent.count(),
        tx.billingWebhookEvent.count({ where: { signatureValid: true } }),
        tx.billingWebhookEvent.count({ where: { signatureValid: false } }),
      ]);

      return {
        config: config
          ? {
              adapterMode: config.adapterMode,
              apiBaseUrl: config.apiBaseUrl,
              productSlug: config.productSlug,
              storefrontUrl: config.storefrontUrl,
              productSecretRef: config.productSecretRef,
              productSecretConfigured: config.productSecretRef
                ? Boolean(env[config.productSecretRef])
                : false,
              webhookSecretRef: config.webhookSecretRef,
              webhookSecretConfigured: config.webhookSecretRef
                ? Boolean(env[config.webhookSecretRef])
                : false,
              ed25519PublicKey: config.ed25519PublicKey,
              saasLicensingApproved: config.saasLicensingApproved,
              compatibilityNote: config.compatibilityNote,
              catalogSnapshot:
                (config.catalogSnapshot as BerlangganCatalogPlan[] | null) ??
                null,
              catalogFetchedAt: config.catalogFetchedAt?.toISOString() ?? null,
              updatedAt: config.updatedAt.toISOString(),
            }
          : null,
        webhookHealth: {
          total: totalEvents,
          valid: validEvents,
          rejected: rejectedEvents,
          recent: events.map((e) => ({
            id: e.id,
            eventId: e.eventId,
            eventType: e.eventType,
            signatureValid: e.signatureValid,
            status: e.status,
            errorCode: e.errorCode,
            receivedAt: e.receivedAt.toISOString(),
          })),
        },
      };
    });
  }

  async function mutateAdminBilling(sessionId: string, raw: unknown) {
    const command = adminBillingCommandSchema.parse(raw);

    if (command.action === "configure") {
      return db.$transaction(async (tx) => {
        const session = await requireSuperadmin(tx, sessionId);
        if (command.adapterMode === "BERLANGGAN_LIVE") {
          if (!command.apiBaseUrl || !command.productSlug) {
            throw new BillingError("INVALID_CONFIGURATION");
          }
        }
        const effectivePublicKey =
          command.adapterMode === "SYNTHETIC_TEST" && !command.ed25519PublicKey
            ? getSyntheticKeyPair().publicKeyPem
            : command.ed25519PublicKey;

        const updated = await tx.billingConfig.upsert({
          where: { id: "default" },
          create: {
            id: "default",
            adapterMode: command.adapterMode,
            apiBaseUrl: command.apiBaseUrl,
            productSlug: command.productSlug,
            storefrontUrl: command.storefrontUrl,
            productSecretRef: command.productSecretRef,
            webhookSecretRef: command.webhookSecretRef,
            ed25519PublicKey: effectivePublicKey,
            saasLicensingApproved: command.saasLicensingApproved,
            compatibilityNote: command.compatibilityNote,
            updatedBy: session.userId,
          },
          update: {
            adapterMode: command.adapterMode,
            apiBaseUrl: command.apiBaseUrl,
            productSlug: command.productSlug,
            storefrontUrl: command.storefrontUrl,
            productSecretRef: command.productSecretRef,
            webhookSecretRef: command.webhookSecretRef,
            ed25519PublicKey: effectivePublicKey,
            saasLicensingApproved: command.saasLicensingApproved,
            compatibilityNote: command.compatibilityNote,
            updatedBy: session.userId,
          },
        });
        return {
          adapterMode: updated.adapterMode,
          saasLicensingApproved: updated.saasLicensingApproved,
        };
      });
    }

    // action === "fetch_catalog"
    const config = await db.$transaction(async (tx) => {
      await requireSuperadmin(tx, sessionId);
      return tx.billingConfig.findUnique({ where: { id: "default" } });
    });
    if (
      !config ||
      config.adapterMode !== "BERLANGGAN_LIVE" ||
      !config.apiBaseUrl ||
      !config.productSlug
    ) {
      throw new BillingError("BILLING_NOT_CONFIGURED");
    }

    const { adapter } = resolveAdapter(config);
    const plans = await adapter.fetchCatalogPlans(config.productSlug);

    return db.$transaction(async (tx) => {
      const session = await requireSuperadmin(tx, sessionId);
      const now = await databaseNow(tx);
      await tx.billingConfig.update({
        where: { id: "default" },
        data: {
          catalogSnapshot: plans as unknown as Prisma.InputJsonValue,
          catalogFetchedAt: now,
          updatedBy: session.userId,
        },
      });
      return { plansCount: plans.length, plans };
    });
  }

  async function getOrgBillingState(sessionId: string) {
    return withActive(
      sessionId,
      undefined,
      async (tx, { session, membership }) => {
        const organizationId = membership.organizationId;
        const now = await databaseNow(tx);

        const [config, license, trial, resolved] = await Promise.all([
          tx.billingConfig.findUnique({ where: { id: "default" } }),
          tx.organizationLicense.findUnique({ where: { organizationId } }),
          tx.trialAccount.findUnique({
            where: { userId: session.userId },
            include: { _count: { select: { usage: true } } },
          }),
          resolveWorkspaceEntitlements(tx, organizationId, now),
        ]);

        return {
          role: membership.role,
          compatibilityGate: {
            adapterMode: config?.adapterMode ?? "NOT_CONFIGURED",
            saasLicensingApproved: config?.saasLicensingApproved ?? false,
            compatibilityNote: config?.compatibilityNote ?? "",
            storefrontUrl:
              config?.adapterMode === "BERLANGGAN_LIVE" &&
              config.saasLicensingApproved
                ? config.storefrontUrl
                : null,
            catalogPlans:
              config?.adapterMode === "BERLANGGAN_LIVE" &&
              config.saasLicensingApproved
                ? ((config.catalogSnapshot as BerlangganCatalogPlan[] | null) ??
                  [])
                : [],
          },
          trial: trial
            ? {
                activatedAt: trial.activatedAt.toISOString(),
                expiresAt: trial.expiresAt.toISOString(),
                usedTotal: trial._count.usage,
                maxTotal: 3,
                maxPerJakartaDay: 1,
              }
            : null,
          license: license
            ? {
                licenseKeyHint: license.licenseKeyHint,
                fingerprint: license.fingerprint,
                status: resolved.licenseStatus,
                rawStatus: license.status,
                planCode: license.planCode,
                lastErrorCode: license.lastErrorCode,
                tokenExpiresAt: license.tokenExpiresAt?.toISOString() ?? null,
                licenseExpiresAt:
                  license.licenseExpiresAt?.toISOString() ?? null,
                lastValidatedAt: license.lastValidatedAt?.toISOString() ?? null,
              }
            : null,
          entitlementSummary: resolved,
        };
      },
    );
  }

  async function persistVerifiedProviderResponse(
    tx: Tx,
    params: {
      organizationId: string;
      actorUserId: string;
      licenseKeyCipher: string | null;
      licenseKeyHint: string | null;
      licenseKeyIndex: string | null;
      licenseKeySha256: string | null;
      fingerprint: string;
      response: unknown;
      publicKey: string | null;
      isActivation: boolean;
      now: Date;
    },
  ): Promise<{ status: LicenseStatus; errorCode: string | null }> {
    const parsed = berlangganActivationResponseSchema.parse(params.response);
    let mappedStatus = mapApiStatusToLicenseStatus(parsed.status);
    let errorCode: string | null = null;
    let verifiedEntitlements: Record<string, unknown> | null = null;
    let verifiedEnvelope: Record<string, unknown> | null = null;
    let verifiedSignature: string | null = null;

    if (mappedStatus === "ACTIVE" || mappedStatus === "GRACE") {
      const signatureValid = verifyBerlangganEd25519(
        parsed.entitlement,
        parsed.entitlement_signature,
        params.publicKey,
      );
      if (!signatureValid) {
        mappedStatus = "INVALID";
        errorCode = "ENTITLEMENT_SIGNATURE_INVALID";
      } else {
        verifiedEnvelope = parsed.entitlement ?? null;
        verifiedSignature = parsed.entitlement_signature ?? null;
        verifiedEntitlements =
          parsed.entitlements ??
          (parsed.entitlement?.entitlements as Record<string, unknown>) ??
          {};
      }
    } else {
      errorCode = `LICENSE_${mappedStatus}`;
    }

    await tx.organizationLicense.upsert({
      where: { organizationId: params.organizationId },
      create: {
        organizationId: params.organizationId,
        licenseKeyCipher: params.licenseKeyCipher,
        licenseKeyHint: params.licenseKeyHint,
        licenseKeyIndex: params.licenseKeyIndex,
        licenseKeySha256: params.licenseKeySha256,
        fingerprint: params.fingerprint,
        status: mappedStatus,
        planCode: parsed.plan_code ?? null,
        entitlements: verifiedEntitlements as Prisma.InputJsonValue,
        entitlementEnvelope: verifiedEnvelope as Prisma.InputJsonValue,
        entitlementSignature: verifiedSignature,
        tokenExpiresAt: parsed.token_expires_at
          ? new Date(parsed.token_expires_at)
          : null,
        licenseExpiresAt: parsed.license_expires_at
          ? new Date(parsed.license_expires_at)
          : null,
        lastValidatedAt: params.now,
        lastErrorCode: errorCode,
        activatedBy: params.isActivation ? params.actorUserId : null,
        updatedBy: params.actorUserId,
      },
      update: {
        ...(params.licenseKeyCipher
          ? {
              licenseKeyCipher: params.licenseKeyCipher,
              licenseKeyHint: params.licenseKeyHint,
              licenseKeyIndex: params.licenseKeyIndex,
              licenseKeySha256: params.licenseKeySha256,
            }
          : {}),
        fingerprint: params.fingerprint,
        status: mappedStatus,
        planCode: parsed.plan_code ?? null,
        entitlements: verifiedEntitlements as Prisma.InputJsonValue,
        entitlementEnvelope: verifiedEnvelope as Prisma.InputJsonValue,
        entitlementSignature: verifiedSignature,
        tokenExpiresAt: parsed.token_expires_at
          ? new Date(parsed.token_expires_at)
          : null,
        licenseExpiresAt: parsed.license_expires_at
          ? new Date(parsed.license_expires_at)
          : null,
        lastValidatedAt: params.now,
        lastErrorCode: errorCode,
        ...(params.isActivation ? { activatedBy: params.actorUserId } : {}),
        updatedBy: params.actorUserId,
      },
    });

    await tx.workspaceAudit.create({
      data: {
        organizationId: params.organizationId,
        actorId: params.actorUserId,
        action: `BILLING_LICENSE_${mappedStatus}`,
      },
    });

    return { status: mappedStatus, errorCode };
  }

  async function executeOrgBillingCommand(sessionId: string, raw: unknown) {
    const command = orgBillingCommandSchema.parse(raw);

    const prep = await withActive(
      sessionId,
      "team.manage",
      async (tx, { session, membership }) => {
        const organizationId = membership.organizationId;
        const [config, license] = await Promise.all([
          tx.billingConfig.findUnique({ where: { id: "default" } }),
          tx.organizationLicense.findUnique({ where: { organizationId } }),
        ]);

        if (!config || config.adapterMode === "NOT_CONFIGURED") {
          throw new BillingError("BILLING_NOT_CONFIGURED");
        }
        // Fail closed for production live billing unless provider confirmed
        // hosted SaaS multi-tenant licensing compatibility!
        if (
          config.adapterMode === "BERLANGGAN_LIVE" &&
          !config.saasLicensingApproved
        ) {
          throw new BillingError("SAAS_LICENSING_UNAPPROVED");
        }

        const fingerprint =
          command.action === "activate"
            ? (command.fingerprint ?? `serentax-tenant:${organizationId}`)
            : (license?.fingerprint ?? `serentax-tenant:${organizationId}`);

        let licenseKey: string;
        let protectedKey:
          { cipher: string; index: string; hint: string } | undefined;
        let keySha256: string | null = license?.licenseKeySha256 ?? null;

        if (command.action === "activate") {
          licenseKey = command.licenseKey;
          protectedKey = taxCrypto.protect(
            organizationId,
            "BILLING_LICENSE_KEY",
            licenseKey,
          );
          keySha256 = sha256Hex(licenseKey);
        } else {
          if (!license?.licenseKeyCipher) {
            throw new BillingError("NOT_FOUND");
          }
          licenseKey = taxCrypto.reveal(
            organizationId,
            "BILLING_LICENSE_KEY",
            license.licenseKeyCipher,
          );
        }

        return {
          organizationId,
          userId: session.userId,
          config,
          fingerprint,
          licenseKey,
          protectedKey,
          keySha256,
        };
      },
    );

    const { adapter, publicKey } = resolveAdapter(prep.config);

    if (command.action === "deactivate") {
      await adapter.deactivate({
        licenseKey: prep.licenseKey,
        fingerprint: prep.fingerprint,
      });
      return db.$transaction(async (tx) => {
        await lockWorkspace(tx, prep.organizationId);
        await tx.organizationLicense.updateMany({
          where: { organizationId: prep.organizationId },
          data: {
            status: "REVOKED",
            entitlements: null as unknown as Prisma.InputJsonValue,
            entitlementEnvelope: null as unknown as Prisma.InputJsonValue,
            entitlementSignature: null,
            lastErrorCode: "DEACTIVATED_BY_OWNER",
            updatedBy: prep.userId,
          },
        });
        await tx.workspaceAudit.create({
          data: {
            organizationId: prep.organizationId,
            actorId: prep.userId,
            action: "BILLING_LICENSE_DEACTIVATED",
          },
        });
        return { status: "REVOKED" as const };
      });
    }

    const providerResponse =
      command.action === "activate"
        ? await adapter.activate({
            licenseKey: prep.licenseKey,
            fingerprint: prep.fingerprint,
          })
        : await adapter.validate({
            licenseKey: prep.licenseKey,
            fingerprint: prep.fingerprint,
          });

    const outcome = await db.$transaction(async (tx) => {
      await lockWorkspace(tx, prep.organizationId);
      const now = await databaseNow(tx);
      return persistVerifiedProviderResponse(tx, {
        organizationId: prep.organizationId,
        actorUserId: prep.userId,
        licenseKeyCipher: prep.protectedKey?.cipher ?? null,
        licenseKeyHint: prep.protectedKey
          ? `****${identityHint(prep.licenseKey)}`
          : null,
        licenseKeyIndex: prep.protectedKey?.index ?? null,
        licenseKeySha256: prep.keySha256,
        fingerprint: prep.fingerprint,
        response: providerResponse,
        publicKey,
        isActivation: command.action === "activate",
        now,
      });
    });

    if (outcome.errorCode === "ENTITLEMENT_SIGNATURE_INVALID") {
      throw new BillingError("ENTITLEMENT_SIGNATURE_INVALID");
    }
    return outcome;
  }

  async function receiveWebhook(
    rawBody: Uint8Array | Buffer,
    signatureHeader: string | null | undefined,
  ) {
    const config = await db.billingConfig.findUnique({
      where: { id: "default" },
    });
    if (!config || config.adapterMode === "NOT_CONFIGURED") {
      throw new BillingError("BILLING_NOT_CONFIGURED");
    }
    const webhookSecret = config.webhookSecretRef
      ? (env[config.webhookSecretRef] ?? null)
      : null;
    if (!webhookSecret) {
      throw new BillingProviderError("PROVIDER_SECRET_MISSING");
    }

    const sigOk = verifyBerlangganWebhookHmac(
      rawBody,
      signatureHeader,
      webhookSecret,
    );
    if (!sigOk) {
      throw new BillingError("INVALID_WEBHOOK_SIGNATURE");
    }

    const rawText = Buffer.from(rawBody).toString("utf8");
    const payloadHash = sha256Hex(rawBody);
    const payload = berlangganWebhookPayloadSchema.parse(JSON.parse(rawText));

    const existingEvent = await db.billingWebhookEvent.findUnique({
      where: { eventId: payload.event_id },
    });
    if (existingEvent) {
      return {
        received: true,
        replay: true,
        status: existingEvent.status,
      };
    }

    const licenseKeyHash = payload.license_key
      ? sha256Hex(payload.license_key)
      : null;
    const matchedLicense = licenseKeyHash
      ? await db.organizationLicense.findFirst({
          where: { licenseKeySha256: licenseKeyHash },
        })
      : null;

    if (!matchedLicense) {
      await db.billingWebhookEvent.create({
        data: {
          eventId: payload.event_id,
          eventType: payload.event_type,
          licenseKeyHash,
          payloadHash,
          signatureValid: true,
          status: "IGNORED_UNMATCHED",
          payloadSummary: {
            plan_code: payload.plan_code ?? null,
            occurred_at: payload.occurred_at ?? null,
          } as Prisma.InputJsonValue,
        },
      });
      return { received: true, replay: false, status: "IGNORED_UNMATCHED" };
    }

    if (
      config.adapterMode === "BERLANGGAN_LIVE" &&
      !config.saasLicensingApproved
    ) {
      await db.$transaction(async (tx) => {
        await tx.billingWebhookEvent.create({
          data: {
            eventId: payload.event_id,
            eventType: payload.event_type,
            organizationId: matchedLicense.organizationId,
            licenseKeyHash,
            payloadHash,
            signatureValid: true,
            status: "REJECTED_COMPATIBILITY",
            errorCode: "SAAS_LICENSING_UNAPPROVED",
            payloadSummary: {
              plan_code: payload.plan_code ?? null,
              occurred_at: payload.occurred_at ?? null,
            } as Prisma.InputJsonValue,
          },
        });
      });
      return {
        received: true,
        replay: false,
        status: "REJECTED_COMPATIBILITY",
      };
    }

    // Immediate suspension or live validation refresh upon authenticated webhook.
    let refreshResponse: unknown = null;
    if (
      payload.event_type !== "license.suspended" &&
      matchedLicense.licenseKeyCipher
    ) {
      const { adapter } = resolveAdapter(config);
      const revealedKey = taxCrypto.reveal(
        matchedLicense.organizationId,
        "BILLING_LICENSE_KEY",
        matchedLicense.licenseKeyCipher,
      );
      refreshResponse = await adapter.validate({
        licenseKey: revealedKey,
        fingerprint: matchedLicense.fingerprint,
      });
    }

    const { publicKey } = resolveAdapter(config);

    await db.$transaction(async (tx) => {
      await lockWorkspace(tx, matchedLicense.organizationId);
      const now = await databaseNow(tx);

      if (payload.event_type === "license.suspended") {
        await tx.organizationLicense.update({
          where: { organizationId: matchedLicense.organizationId },
          data: {
            status: "SUSPENDED",
            entitlements: null as unknown as Prisma.InputJsonValue,
            entitlementEnvelope: null as unknown as Prisma.InputJsonValue,
            entitlementSignature: null,
            lastValidatedAt: now,
            lastErrorCode: "WEBHOOK_SUSPENDED",
            updatedBy: "system:berlanggan-webhook",
          },
        });
        await tx.workspaceAudit.create({
          data: {
            organizationId: matchedLicense.organizationId,
            actorId: "system:berlanggan-webhook",
            action: "BILLING_WEBHOOK_SUSPENDED",
          },
        });
      } else if (refreshResponse) {
        await persistVerifiedProviderResponse(tx, {
          organizationId: matchedLicense.organizationId,
          actorUserId: "system:berlanggan-webhook",
          licenseKeyCipher: null,
          licenseKeyHint: null,
          licenseKeyIndex: null,
          licenseKeySha256: null,
          fingerprint: matchedLicense.fingerprint,
          response: refreshResponse,
          publicKey,
          isActivation: false,
          now,
        });
      }

      await tx.billingWebhookEvent.create({
        data: {
          eventId: payload.event_id,
          eventType: payload.event_type,
          organizationId: matchedLicense.organizationId,
          licenseKeyHash,
          payloadHash,
          signatureValid: true,
          status: "PROCESSED",
          payloadSummary: {
            plan_code: payload.plan_code ?? null,
            occurred_at: payload.occurred_at ?? null,
          } as Prisma.InputJsonValue,
        },
      });
    });

    return { received: true, replay: false, status: "PROCESSED" };
  }

  return {
    listAdminBilling,
    mutateAdminBilling,
    getOrgBillingState,
    executeOrgBillingCommand,
    receiveWebhook,
  };
}
