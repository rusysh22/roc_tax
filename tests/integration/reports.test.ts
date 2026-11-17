import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { postgresOptions } from "../../apps/web/src/server/postgres";
import { PrismaClient } from "../../apps/web/src/generated/prisma/client";
import { createTaxCrypto } from "../../apps/web/src/server/intake/crypto";
import { intakeService } from "../../apps/web/src/server/intake/service";
import { localDocumentStorage } from "../../apps/web/src/server/intake/storage";
import { exportService } from "../../apps/web/src/server/export/service";
import { reportsService } from "../../apps/web/src/server/reports/service";
import { taxService } from "../../apps/web/src/server/tax/service";
import { trialService } from "../../apps/web/src/server/trial/service";
import type { Role } from "../../apps/web/src/server/workspaces/policy";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test")) {
  throw new Error("Isolated _test database required");
}
const db = new PrismaClient({
  adapter: new PrismaPg({ ...postgresOptions(url), max: 15 }),
});
const storageDir = mkdtempSync(
  path.join(os.tmpdir(), "serentax-reports-integration-"),
);
const crypto = createTaxCrypto(
  "synthetic-reports-integration-secret-0123456789",
);
const storage = localDocumentStorage(storageDir);
const intake = intakeService(db, crypto, storage);
const tax = taxService(db);
const exporter = exportService(db, crypto, storage);
const reports = reportsService(db);
const trials = trialService(db);

const users: string[] = [];
const orgs: string[] = [];
const ruleIds: string[] = [];

async function createActor(
  role: Role = "OWNER",
  platformRole: "NONE" | "SUPERADMIN" = "NONE",
) {
  const userId = randomUUID();
  users.push(userId);
  await db.user.create({
    data: {
      id: userId,
      name: `Synthetic Reports ${role}`,
      email: `${userId}@example.test`,
      emailVerified: true,
      platformRole,
    },
  });
  const org = await db.organization.create({
    data: {
      name: "=cmd|' /C calc'!A0 PT Synthetic Org",
      legalName: "PT Synthetic Reconciliation",
      memberships: { create: { userId, role } },
    },
  });
  orgs.push(org.id);
  const sessionId = randomUUID();
  await db.session.create({
    data: {
      id: sessionId,
      token: randomUUID(),
      userId,
      activeOrganizationId: org.id,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  return { userId, sessionId, organizationId: org.id };
}

async function addMember(
  organizationId: string,
  role: Role,
  activateTrial = false,
) {
  const userId = randomUUID();
  users.push(userId);
  await db.user.create({
    data: {
      id: userId,
      name: `Synthetic ${role}`,
      email: `${userId}@example.test`,
      emailVerified: true,
    },
  });
  await db.membership.create({
    data: { organizationId, userId, role },
  });
  const sessionId = randomUUID();
  await db.session.create({
    data: {
      id: sessionId,
      token: randomUUID(),
      userId,
      activeOrganizationId: organizationId,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  if (activateTrial) await trials.activate(sessionId);
  return { userId, sessionId };
}

afterAll(async () => {
  await db.supportAccessAudit.deleteMany({
    where: { organizationId: { in: orgs } },
  });
  await db.xmlExportOutcome.deleteMany({
    where: { organizationId: { in: orgs } },
  });
  await db.xmlExportItem.deleteMany({
    where: { organizationId: { in: orgs } },
  });
  await db.xmlExportBatch.deleteMany({
    where: { organizationId: { in: orgs } },
  });
  await db.trialUsage.deleteMany({ where: { userId: { in: users } } });
  await db.trialAccount.deleteMany({ where: { userId: { in: users } } });
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.taxRule.deleteMany({ where: { id: { in: ruleIds } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
  rmSync(storageDir, { recursive: true, force: true });
});

describe("reconciliation reports, CSV export & privacy-preserving superadmin support on PostgreSQL", () => {
  it("tracks manual Coretax submitted/accepted outcomes, reconciles filters & formula-safe CSV, and gates superadmin support access", async () => {
    const owner = await createActor("OWNER");
    const preparer = await addMember(owner.organizationId, "PREPARER", true);
    const approver = await addMember(owner.organizationId, "APPROVER");
    const superadmin = await createActor("OWNER", "SUPERADMIN");

    const objCode = `REP-${randomUUID().slice(0, 6).toUpperCase()}`;
    const rule = (await tax.mutateRule(superadmin.sessionId, {
      action: "create",
      code: `CODE-${objCode}`,
      version: 1,
      taxFamily: "PPH_UNIFIKASI_BPPU",
      documentType: "SUPPLIER_INVOICE",
      objectCode: objCode,
      name: "Reconciliation Synthetic Rule",
      effectiveFrom: "2026-01-01",
      rateNumerator: 2,
      rateDenominator: 100,
      roundingMode: "HALF_UP",
      sourceCitation: "Synthetic SME Fixture",
      catalogStatus: "SME_APPROVED",
      smeReviewedBy: "SME Report",
    })) as { id: string };
    ruleIds.push(rule.id);

    const company = await intake.mutateCompany(owner.sessionId, {
      action: "create",
      company: {
        name: "+SUM(1,2) PT Rekonsiliasi",
        legalName: "PT Rekonsiliasi Uji",
        npwp: "0000000000000001",
        nitku: "0000000000000001000000",
      },
    });
    const cp = await intake.mutateCounterparty(owner.sessionId, {
      action: "create",
      counterparty: {
        kind: "VENDOR",
        name: "CV Mitra Rekonsiliasi",
        identityType: "NPWP",
        identity: "0000000000000002",
        countryCode: "ID",
      },
    });

    const txRes = (await intake.createTransaction(preparer.sessionId, {
      action: "create",
      idempotencyKey: randomUUID(),
      draft: {
        companyId: company.id,
        counterpartyId: cp.id,
        taxFamily: "PPH_UNIFIKASI_BPPU",
        documentType: "SUPPLIER_INVOICE",
        invoiceNumber: "REC-INV-01",
        documentDate: "2026-11-16",
        taxPeriod: "2026-11",
        currency: "IDR",
        lines: [
          { description: "Service", quantity: "1", unitPrice: "5000000.00" },
        ],
      },
      acknowledgeDuplicates: false,
    })) as { transactionId: string };

    await tax.executeReviewCommand(preparer.sessionId, txRes.transactionId, {
      action: "evaluate",
      objectCode: objCode,
    });
    const sub = (await tax.executeReviewCommand(
      preparer.sessionId,
      txRes.transactionId,
      { action: "submit", version: 1 },
    )) as { version: number };
    await tax.executeReviewCommand(approver.sessionId, txRes.transactionId, {
      action: "approve",
      version: sub.version,
    });

    const exported = await exporter.generateExport(preparer.sessionId, {
      companyId: company.id,
      taxFamily: "PPH_UNIFIKASI_BPPU",
      taxPeriod: "2026-11",
      transactionIds: [txRes.transactionId],
      idempotencyKey: randomUUID(),
    });

    // Record manual CORETAX_SUBMITTED with verification context; tx remains EXPORTED.
    await exporter.recordOutcome(approver.sessionId, exported.batch.id, {
      outcome: "CORETAX_SUBMITTED",
      coretaxReference: "CT-SUB-01",
      accountHint: "0001",
      portalTimestamp: "2026-11-17T12:00:00.000Z",
      evidenceSha256: "e".repeat(64),
      notes: "Uploaded manually via e-Bupot BPPU",
    });
    const midRep = await reports.getReconciliationReport(owner.sessionId, {
      taxPeriod: "2026-11",
    });
    expect(midRep.cards.coretaxSubmittedCount).toBe(1);
    expect(midRep.cards.exportedCount).toBe(1);
    expect(midRep.rows[0].coretaxOutcome).toBe("CORETAX_SUBMITTED");
    expect(midRep.rows[0].discrepancy).toBe("NONE");

    // Finalize manual acceptance.
    await exporter.recordOutcome(approver.sessionId, exported.batch.id, {
      outcome: "CORETAX_ACCEPTED",
      coretaxReference: "CT-ACC-02",
    });
    const finalRep = await reports.getReconciliationReport(owner.sessionId, {
      taxFamily: "PPH_UNIFIKASI_BPPU",
      search: "REC-INV",
    });
    expect(finalRep.cards.coretaxAcceptedCount).toBe(1);
    expect(finalRep.rows[0].approvedTaxAmount).toBe("100000.00");

    // Authorized CSV export neutralizes formula injection in company name (+SUM -> '+SUM).
    const csv = await reports.exportReconciliationCsv(owner.sessionId, {});
    const csvText = new TextDecoder("utf-8").decode(csv.bytes);
    expect(csvText).toContain("'+SUM(1,2) PT Rekonsiliasi");
    expect(csvText).toContain("CORETAX_ACCEPTED");

    // Privacy & support access gates for Superadmin.
    await expect(
      reports.getSuperadminOverview(owner.sessionId, {}),
    ).rejects.toThrow("FORBIDDEN");
    const overview = await reports.getSuperadminOverview(
      superadmin.sessionId,
      {},
    );
    expect(
      overview.platformHealth.xmlTemplates.verified,
    ).toBeGreaterThanOrEqual(1);
    const orgEntry = overview.organizations.find(
      (o) => o.id === owner.organizationId,
    );
    expect(orgEntry?.activeSupportGrantId).toBeNull();

    // Superadmin cannot inspect tenant diagnostics without active consent grant.
    await expect(
      reports.inspectTenantSupport(superadmin.sessionId, {
        organizationId: owner.organizationId,
        grantId: "nonexistent",
        reason: "Unauthorized probe",
      }),
    ).rejects.toThrow("SUPPORT_ACCESS_GRANT_REQUIRED");

    // Non-OWNER/ADMIN cannot grant support access.
    await expect(
      reports.mutateWorkspaceSupportAccess(preparer.sessionId, {
        action: "grant",
        reason: "Preparer attempt",
        durationMinutes: 30,
      }),
    ).rejects.toThrow("FORBIDDEN");

    // Owner grants time-boxed access; Superadmin inspects redacted diagnostics & audit is immutable.
    const granted = (await reports.mutateWorkspaceSupportAccess(
      owner.sessionId,
      {
        action: "grant",
        reason: "Ticket SUP-101 XML checksum check",
        durationMinutes: 30,
      },
    )) as { grantId: string };

    const diagnostics = await reports.inspectTenantSupport(
      superadmin.sessionId,
      {
        organizationId: owner.organizationId,
        grantId: granted.grantId,
        reason: "Checking SUP-101 export batch hash",
      },
    );
    expect(diagnostics.privacyMode).toBe("REDACTED_DIAGNOSTICS_ONLY");
    expect(diagnostics.recentExportBatches[0].xmlSha256Prefix).toHaveLength(12);

    const supportAuditRow = await db.supportAccessAudit.findFirstOrThrow({
      where: { organizationId: owner.organizationId, grantId: granted.grantId },
    });
    await expect(
      db.$executeRaw`UPDATE "SupportAccessAudit" SET reason = 'tampered' WHERE id = ${supportAuditRow.id}`,
    ).rejects.toThrow();

    // Revoking immediately blocks subsequent Superadmin support access.
    await reports.mutateWorkspaceSupportAccess(owner.sessionId, {
      action: "revoke",
      grantId: granted.grantId,
    });
    await expect(
      reports.inspectTenantSupport(superadmin.sessionId, {
        organizationId: owner.organizationId,
        grantId: granted.grantId,
        reason: "Post-revocation access check",
      }),
    ).rejects.toThrow("SUPPORT_ACCESS_GRANT_REQUIRED");
  });
});
