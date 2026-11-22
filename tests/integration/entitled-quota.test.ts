import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { postgresOptions } from "../../apps/web/src/server/postgres";
import {
  PrismaClient,
  type Prisma,
} from "../../apps/web/src/generated/prisma/client";
import { createTaxCrypto } from "../../apps/web/src/server/intake/crypto";
import { intakeService } from "../../apps/web/src/server/intake/service";
import { importBatchService } from "../../apps/web/src/server/intake/imports";
import { localDocumentStorage } from "../../apps/web/src/server/intake/storage";
import { trialService } from "../../apps/web/src/server/trial/service";
import {
  createTestEd25519KeyPair,
  signCanonicalEntitlement,
  syntheticEd25519KeyPair,
} from "../../apps/web/src/server/billing/crypto";
import type { Role } from "../../apps/web/src/server/workspaces/policy";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Isolated _test database required");
const db = new PrismaClient({
  adapter: new PrismaPg({ ...postgresOptions(url), max: 15 }),
});
const crypto = createTaxCrypto("synthetic-entitled-quota-secret-0123456789");
const intake = intakeService(db, crypto, localDocumentStorage());
const imports = importBatchService(db, crypto);
const trials = trialService(db);
const keyPair = createTestEd25519KeyPair();

const users: string[] = [];
const orgs: string[] = [];
let savedConfig: Awaited<ReturnType<typeof db.billingConfig.findUnique>> = null;

async function addUser(organizationId: string | null, role: Role) {
  const userId = randomUUID();
  users.push(userId);
  await db.user.create({
    data: {
      id: userId,
      name: `Synthetic Quota ${role}`,
      email: `${userId}@example.test`,
      emailVerified: true,
    },
  });
  let orgId = organizationId;
  if (!orgId) {
    const org = await db.organization.create({
      data: { name: "Synthetic Quota Org", legalName: "PT Synthetic Quota" },
    });
    orgs.push(org.id);
    orgId = org.id;
  }
  await db.membership.create({
    data: { organizationId: orgId, userId, role },
  });
  const sessionId = randomUUID();
  await db.session.create({
    data: {
      id: sessionId,
      token: randomUUID(),
      userId,
      activeOrganizationId: orgId,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  return { userId, sessionId, organizationId: orgId };
}

async function workspace() {
  const owner = await addUser(null, "OWNER");
  const preparer = await addUser(owner.organizationId, "PREPARER");
  const company = await intake.mutateCompany(owner.sessionId, {
    action: "create",
    company: { name: "PT Kuota Uji", legalName: "PT Kuota Uji" },
  });
  const counterparty = (await intake.mutateCounterparty(owner.sessionId, {
    action: "create",
    counterparty: {
      kind: "VENDOR",
      name: "CV Kuota Rekan",
      identityType: "NPWP",
      identity: "0000000000000099",
      countryCode: "ID",
    },
  })) as { id: string };
  return { owner, preparer, companyId: company.id, cpId: counterparty.id };
}

/** Grants a signature-valid license with the given entitlement map. */
async function grantLicense(
  organizationId: string,
  entitlements: Record<string, unknown>,
  options: { badSignature?: boolean } = {},
) {
  const envelope = {
    status: "active",
    plan_code: "SYNTH-QUOTA",
    license_expires_at: new Date(Date.now() + 86400000).toISOString(),
    entitlements,
  };
  const signature = options.badSignature
    ? Buffer.alloc(64, 1).toString("base64")
    : signCanonicalEntitlement(envelope, keyPair.privateKeyPem);
  await db.organizationLicense.upsert({
    where: { organizationId },
    create: {
      organizationId,
      fingerprint: `serentax-tenant:${organizationId}`,
      status: "ACTIVE",
      planCode: "SYNTH-QUOTA",
      entitlements: entitlements as Prisma.InputJsonValue,
      entitlementEnvelope: envelope as Prisma.InputJsonValue,
      entitlementSignature: signature,
      licenseExpiresAt: new Date(Date.now() + 86400000),
      updatedBy: "integration-test",
    },
    update: {
      entitlements: entitlements as Prisma.InputJsonValue,
      entitlementEnvelope: envelope as Prisma.InputJsonValue,
      entitlementSignature: signature,
    },
  });
}

let amountSeq = 1000;
function draft(
  ctx: { companyId: string; cpId: string },
  invoiceNumber: string,
  idempotencyKey: string = randomUUID(),
) {
  return {
    action: "create",
    idempotencyKey,
    acknowledgeDuplicates: false,
    draft: {
      companyId: ctx.companyId,
      counterpartyId: ctx.cpId,
      taxFamily: "PPH_UNIFIKASI_BPPU",
      documentType: "SUPPLIER_INVOICE",
      invoiceNumber,
      documentDate: "2026-11-16",
      taxPeriod: "2026-11",
      currency: "IDR",
      // A unique amount per draft keeps duplicate detection out of the way.
      lines: [
        {
          description: "Jasa uji",
          quantity: "1",
          unitPrice: `${amountSeq++}.00`,
        },
      ],
    },
  };
}

beforeAll(async () => {
  savedConfig = await db.billingConfig.findUnique({ where: { id: "default" } });
  await db.billingConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      adapterMode: "SYNTHETIC_TEST",
      ed25519PublicKey: keyPair.publicKeyPem,
    },
    update: {
      adapterMode: "SYNTHETIC_TEST",
      ed25519PublicKey: keyPair.publicKeyPem,
      saasLicensingApproved: false,
    },
  });
});

afterAll(async () => {
  await db.entitledUsage.deleteMany({
    where: { organizationId: { in: orgs } },
  });
  await db.trialUsage.deleteMany({ where: { userId: { in: users } } });
  await db.trialAccount.deleteMany({ where: { userId: { in: users } } });
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  if (savedConfig) {
    const { id, createdAt, updatedAt, catalogSnapshot, ...rest } = savedConfig;
    void createdAt;
    void updatedAt;
    await db.billingConfig.update({
      where: { id },
      data: {
        ...rest,
        catalogSnapshot: (catalogSnapshot ?? undefined) as
          Prisma.InputJsonValue | undefined,
      },
    });
  } else await db.billingConfig.deleteMany({ where: { id: "default" } });
  await db.$disconnect();
});

describe("subscription-entitled transaction quota on PostgreSQL", () => {
  it("lets a licensed workspace exceed trial limits within MONTHLY_TRANSACTIONS, idempotently and without refunds", async () => {
    const ctx = await workspace();
    const { sessionId, userId } = ctx.preparer;

    // Without a license the trial rules apply unchanged.
    await expect(
      intake.createTransaction(sessionId, draft(ctx, "Q-0")),
    ).rejects.toThrow("NOT_ACTIVATED");
    await trials.activate(sessionId);
    await intake.createTransaction(sessionId, draft(ctx, "Q-T1"));
    await expect(
      intake.createTransaction(sessionId, draft(ctx, "Q-T2")),
    ).rejects.toThrow("DAILY_LIMIT");

    await grantLicense(ctx.owner.organizationId, { MONTHLY_TRANSACTIONS: 4 });
    const allowance = await trials.allowance(sessionId);
    expect(allowance).toMatchObject({
      mode: "ENTITLED",
      monthlyLimit: 4,
      usedThisMonth: 0,
      remainingThisMonth: 4,
    });

    const key = randomUUID();
    const firstPayload = draft(ctx, "Q-1", key);
    const first = (await intake.createTransaction(sessionId, firstPayload)) as {
      transactionId: string;
      replay: boolean;
    };
    expect(first.replay).toBe(false);
    // Exact replay returns the same draft and writes no second receipt.
    const replay = (await intake.createTransaction(
      sessionId,
      firstPayload,
    )) as { transactionId: string; replay: boolean };
    expect(replay).toEqual({
      transactionId: first.transactionId,
      replay: true,
    });
    // The same key with a different payload is a conflict.
    await expect(
      intake.createTransaction(sessionId, draft(ctx, "Q-1-CHANGED", key)),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");

    for (const n of [2, 3, 4])
      await intake.createTransaction(sessionId, draft(ctx, `Q-${n}`));
    await expect(
      intake.createTransaction(sessionId, draft(ctx, "Q-5")),
    ).rejects.toThrow("MONTHLY_LIMIT");

    // Voiding a draft never restores subscription quota.
    await intake.mutateTransaction(sessionId, first.transactionId, {
      action: "void",
      version: 1,
      reason: "Synthetic void",
    });
    await expect(
      intake.createTransaction(sessionId, draft(ctx, "Q-6")),
    ).rejects.toThrow("MONTHLY_LIMIT");

    expect(
      await db.entitledUsage.count({
        where: { organizationId: ctx.owner.organizationId },
      }),
    ).toBe(4);
    // Subscription use leaves the account's trial ledger untouched.
    expect(await db.trialUsage.count({ where: { userId } })).toBe(1);
    expect(
      await db.workspaceAudit.count({
        where: {
          organizationId: ctx.owner.organizationId,
          action: "ENTITLED_TRANSACTION_CREATED",
        },
      }),
    ).toBe(4);
  });

  it("commits multi-row imports atomically under the cap and rejects over-cap files without partial writes", async () => {
    const ctx = await workspace();
    const { sessionId } = ctx.preparer;
    await grantLicense(ctx.owner.organizationId, { MONTHLY_TRANSACTIONS: 3 });

    const header =
      "invoice_number,document_date,tax_period,document_type,tax_family,counterparty_name,line_description,quantity,unit_price,currency";
    // Distinct amounts per row keep in-file duplicate detection out of the way.
    const row = (n: string) =>
      `IMP-${n},2026-11-16,2026-11,SUPPLIER_INVOICE,PPH_UNIFIKASI_BPPU,CV Kuota Rekan,Jasa ${n},1,${2000 + n.charCodeAt(0)}.00,IDR`;
    const file = (ids: string[]) =>
      new TextEncoder().encode([header, ...ids.map(row)].join("\n"));

    const tooMany = file(["A", "B", "C", "D"]);
    const preview = await imports.preview(sessionId, {
      companyId: ctx.companyId,
      fileName: "over-cap.csv",
      bytes: tooMany,
    });
    expect(preview.validRows).toBe(4);
    expect(preview.entitlement?.remainingThisMonth).toBe(3);
    expect(preview.quotaBlockReason).toBe("MONTHLY_LIMIT");
    expect(preview.eligibleToCommit).toBe(false);
    await expect(
      imports.commit(sessionId, {
        idempotencyKey: randomUUID(),
        companyId: ctx.companyId,
        fileName: "over-cap.csv",
        bytes: tooMany,
        acknowledgeDuplicates: false,
      }),
    ).rejects.toThrow("MONTHLY_LIMIT");
    expect(
      await db.transaction.count({
        where: { organizationId: ctx.owner.organizationId },
      }),
    ).toBe(0);

    const ok = file(["A", "B", "C"]);
    const okPreview = await imports.preview(sessionId, {
      companyId: ctx.companyId,
      fileName: "ok.csv",
      bytes: ok,
    });
    expect(okPreview.eligibleToCommit).toBe(true);
    const batchKey = randomUUID();
    const committed = await imports.commit(sessionId, {
      idempotencyKey: batchKey,
      companyId: ctx.companyId,
      fileName: "ok.csv",
      bytes: ok,
      acknowledgeDuplicates: false,
    });
    expect(committed.createdCount).toBe(3);
    expect(committed.transactionIds).toHaveLength(3);
    const replay = await imports.commit(sessionId, {
      idempotencyKey: batchKey,
      companyId: ctx.companyId,
      fileName: "ok.csv",
      bytes: ok,
      acknowledgeDuplicates: false,
    });
    expect(replay.replay).toBe(true);
    expect(replay.batchId).toBe(committed.batchId);
    expect(
      await db.entitledUsage.count({
        where: { organizationId: ctx.owner.organizationId },
      }),
    ).toBe(3);
  });

  it("fails closed on a missing entitlement and ignores licenses with invalid signatures", async () => {
    const missing = await workspace();
    await grantLicense(missing.owner.organizationId, { MAX_COMPANIES: 5 });
    await expect(
      intake.createTransaction(
        missing.preparer.sessionId,
        draft(missing, "M-1"),
      ),
    ).rejects.toThrow("ENTITLEMENT_MISSING");

    const forged = await workspace();
    await grantLicense(
      forged.owner.organizationId,
      { MONTHLY_TRANSACTIONS: 100 },
      { badSignature: true },
    );
    // A forged entitlement grants nothing: creation falls back to the trial rules.
    expect(await trials.allowance(forged.preparer.sessionId)).toBeNull();
    await expect(
      intake.createTransaction(forged.preparer.sessionId, draft(forged, "F-1")),
    ).rejects.toThrow("NOT_ACTIVATED");

    const unlimited = await workspace();
    await grantLicense(unlimited.owner.organizationId, {
      MONTHLY_TRANSACTIONS: null,
    });
    expect(await trials.allowance(unlimited.preparer.sessionId)).toMatchObject({
      monthlyLimit: null,
      remainingThisMonth: null,
    });
    for (const n of [1, 2, 3, 4])
      await intake.createTransaction(
        unlimited.preparer.sessionId,
        draft(unlimited, `U-${n}`),
      );
  });

  it("derives the same synthetic billing key from the same secret in every process", () => {
    const secret = "synthetic-entitled-quota-secret-0123456789";
    expect(syntheticEd25519KeyPair(secret).publicKeyPem).toBe(
      syntheticEd25519KeyPair(secret).publicKeyPem,
    );
    expect(syntheticEd25519KeyPair(secret).publicKeyPem).not.toBe(
      syntheticEd25519KeyPair(`${secret}-other`).publicKeyPem,
    );
    expect(() => syntheticEd25519KeyPair("too-short")).toThrow();
  });
});
