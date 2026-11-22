import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client";
import type { TaxCrypto } from "../intake/crypto";
import { AccessError, can } from "../workspaces/policy";
import { requireActor, requireMembership } from "../workspaces/service";

/**
 * Customer data controls: workspace data export (portability), stored-document
 * summary, retention policy, sub-processor list and the no-AI-training
 * commitment. Policy values come from server configuration (env) so the
 * product owner states what is actually true for the deployment.
 */

const subprocessorSchema = z.array(
  z.object({
    name: z.string().min(1).max(120),
    purpose: z.string().min(1).max(200),
    location: z.string().min(1).max(80),
  }),
);
export type Subprocessor = z.infer<typeof subprocessorSchema>[number] & {
  source: "PLATFORM" | "OCR";
};

export type PrivacyConfig = {
  /** Days after subscription end before stored documents are deleted. */
  retentionDaysAfterTermination: number | null;
  /** Days to deliver a data export after a termination request. */
  exportDaysAfterTermination: number | null;
  /** Where customer data is stored (e.g. "AWS ap-southeast-3, Jakarta"). */
  dataLocation: string | null;
  subprocessors: z.infer<typeof subprocessorSchema>;
};

function positiveInt(raw: string | undefined) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= 3650 ? n : null;
}

export function readPrivacyConfig(
  env: NodeJS.ProcessEnv = process.env,
): PrivacyConfig {
  let subprocessors: z.infer<typeof subprocessorSchema> = [];
  if (env.PLATFORM_SUBPROCESSORS) {
    try {
      const parsed = subprocessorSchema.safeParse(
        JSON.parse(env.PLATFORM_SUBPROCESSORS),
      );
      if (parsed.success) subprocessors = parsed.data;
    } catch {
      subprocessors = [];
    }
  }
  return {
    retentionDaysAfterTermination: positiveInt(
      env.DATA_RETENTION_DAYS_AFTER_TERMINATION,
    ),
    exportDaysAfterTermination: positiveInt(
      env.DATA_EXPORT_DAYS_AFTER_TERMINATION,
    ),
    dataLocation: env.DATA_STORAGE_LOCATION?.trim().slice(0, 120) || null,
    subprocessors,
  };
}

export function privacyService(
  db: PrismaClient,
  crypto: TaxCrypto,
  config: PrivacyConfig = readPrivacyConfig(),
) {
  async function activeMembership(sessionId: string) {
    const session = await requireActor(db, sessionId);
    if (!session.activeOrganizationId) throw new AccessError("NO_WORKSPACE");
    return requireMembership(db, sessionId, session.activeOrganizationId);
  }

  /** Data & privacy overview for any member of the active workspace. */
  async function overview(sessionId: string) {
    const { membership } = await activeMembership(sessionId);
    const organizationId = membership.organizationId;
    const [live, deleted, setting] = await Promise.all([
      db.sourceDocument.aggregate({
        where: { organizationId, deletedAt: null },
        _count: { _all: true },
        _sum: { sizeBytes: true },
      }),
      db.sourceDocument.count({
        where: { organizationId, deletedAt: { not: null } },
      }),
      db.organizationOcrSetting.findUnique({
        where: { organizationId },
        include: { provider: true },
      }),
    ]);
    const ocr = setting?.provider;
    const subprocessors: Subprocessor[] = [
      ...config.subprocessors.map((s) => ({
        ...s,
        source: "PLATFORM" as const,
      })),
      ...(ocr &&
      ocr.adapterKey !== "NONE" &&
      ocr.adapterKey !== "SYNTHETIC_TEST"
        ? [
            {
              name: ocr.displayName,
              purpose: "OCR",
              location: ocr.region,
              source: "OCR" as const,
            },
          ]
        : []),
    ];
    return {
      role: membership.role,
      canExport: can(membership.role, "team.manage"),
      documents: {
        stored: live._count._all,
        storedBytes: live._sum.sizeBytes ?? 0,
        deleted,
      },
      ocr: ocr
        ? {
            adapterKey: ocr.adapterKey,
            displayName: ocr.displayName,
            region: ocr.region,
            consent: setting?.externalAiConsent ?? false,
          }
        : null,
      retention: {
        daysAfterTermination: config.retentionDaysAfterTermination,
        exportDaysAfterTermination: config.exportDaysAfterTermination,
        dataLocation: config.dataLocation,
      },
      subprocessors,
    };
  }

  /**
   * Full workspace data export for Owners/Admins (portability). Tax
   * identifiers are decrypted because the customer owns them; the download is
   * audited. Document files are listed by metadata (download them per item).
   */
  async function exportData(sessionId: string) {
    const { membership, session } = await activeMembership(sessionId);
    if (!can(membership.role, "team.manage"))
      throw new AccessError("FORBIDDEN");
    const organizationId = membership.organizationId;
    const reveal = (kind: string, cipher: string | null) =>
      cipher ? crypto.reveal(organizationId, kind, cipher) : null;

    const [
      organization,
      members,
      companies,
      counterparties,
      transactions,
      batches,
      imports,
      audit,
    ] = await Promise.all([
      db.organization.findUniqueOrThrow({ where: { id: organizationId } }),
      db.membership.findMany({
        where: { organizationId },
        include: { user: { select: { name: true, email: true } } },
      }),
      db.company.findMany({ where: { organizationId } }),
      db.counterparty.findMany({ where: { organizationId } }),
      db.transaction.findMany({
        where: { organizationId },
        include: {
          lines: { orderBy: { position: "asc" } },
          documents: true,
          comments: true,
          events: true,
          taxSnapshots: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      db.xmlExportBatch.findMany({
        where: { organizationId },
        include: { items: true, outcomes: true },
      }),
      db.importBatch.findMany({ where: { organizationId } }),
      db.workspaceAudit.findMany({
        where: { organizationId },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    await db.workspaceAudit.create({
      data: {
        organizationId,
        actorId: session.userId,
        action: "DATA_EXPORTED",
        targetId: organizationId,
      },
    });

    return {
      format: "serentax-workspace-export",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      workspace: {
        id: organization.id,
        name: organization.name,
        legalName: organization.legalName,
      },
      members: members.map((m) => ({
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
      companies: companies.map((c) => ({
        id: c.id,
        name: c.name,
        legalName: c.legalName,
        npwp: reveal("COMPANY_NPWP", c.npwpCipher),
        nitku: reveal("COMPANY_NITKU", c.nitkuCipher),
        address: c.address,
        archivedAt: c.archivedAt,
      })),
      counterparties: counterparties.map((c) => ({
        id: c.id,
        kind: c.kind,
        name: c.name,
        identityType: c.identityType,
        identity: reveal(`COUNTERPARTY_${c.identityType}`, c.identityCipher),
        countryCode: c.countryCode,
        address: c.address,
      })),
      transactions: transactions.map((t) => ({
        ...t,
        totalAmount: t.totalAmount.toFixed(2),
        lines: t.lines.map((l) => ({
          position: l.position,
          description: l.description,
          quantity: l.quantity.toFixed(4),
          unitPrice: l.unitPrice.toFixed(2),
          amount: l.amount.toFixed(2),
        })),
        documents: t.documents.map((d) => ({
          id: d.id,
          originalName: d.originalName,
          mimeType: d.mimeType,
          sizeBytes: d.sizeBytes,
          sha256: d.sha256,
          createdAt: d.createdAt,
          deletedAt: d.deletedAt,
          downloadPath: d.deletedAt
            ? null
            : `/api/transactions/${t.id}/documents/${d.id}?download=1`,
        })),
        taxSnapshots: t.taxSnapshots.map((s) => ({
          ...s,
          dppAmount: s.dppAmount.toFixed(2),
          taxAmount: s.taxAmount.toFixed(2),
        })),
      })),
      xmlExports: batches.map((b) => ({
        ...b,
        storageKey: undefined,
        totalDppAmount: b.totalDppAmount.toFixed(2),
        totalTaxAmount: b.totalTaxAmount.toFixed(2),
        items: b.items.map((i) => ({ ...i })),
      })),
      imports,
      audit,
    };
  }

  return { overview, exportData };
}
