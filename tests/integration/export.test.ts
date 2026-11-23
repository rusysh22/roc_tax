import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
import { validateBpuBulkXml } from "../../apps/web/src/lib/export/bppu";
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
  path.join(os.tmpdir(), "serentax-export-integration-"),
);
const crypto = createTaxCrypto(
  "synthetic-export-integration-secret-0123456789",
);
const storage = localDocumentStorage(storageDir);
const intake = intakeService(db, crypto, storage);
const tax = taxService(db);
const exporter = exportService(db, crypto, storage);
const trials = trialService(db);

const users: string[] = [];
const orgs: string[] = [];
const ruleIds: string[] = [];
const customTemplateIds: string[] = [];

async function createActor(
  role: Role = "OWNER",
  platformRole: "NONE" | "SUPERADMIN" = "NONE",
) {
  const userId = randomUUID();
  users.push(userId);
  await db.user.create({
    data: {
      id: userId,
      name: `Synthetic Export ${role}`,
      email: `${userId}@example.test`,
      emailVerified: true,
      platformRole,
    },
  });
  const org = await db.organization.create({
    data: {
      name: "Synthetic Export Org",
      legalName: "PT Synthetic Export",
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
  if (customTemplateIds.length > 0) {
    await db.xmlTemplate.deleteMany({
      where: { id: { in: customTemplateIds } },
    });
  }
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
  rmSync(storageDir, { recursive: true, force: true });
});

describe("Coretax XML template registry & BPPU exporter integration on PostgreSQL", () => {
  it("guards template verification and fails closed with TEMPLATE_UNVERIFIED for unsupported families", async () => {
    const owner = await createActor("OWNER");
    const admin = await createActor("OWNER", "SUPERADMIN");

    await expect(exporter.listAdminTemplates(owner.sessionId)).rejects.toThrow(
      "FORBIDDEN",
    );

    const list = await exporter.listAdminTemplates(admin.sessionId);
    const bppuTpl = list.templates.find(
      (t) => t.versionTag === "BPPU-v3-2025-09",
    );
    expect(bppuTpl?.status).toBe("VERIFIED");
    expect(bppuTpl?.sourceSha256).toBe(list.officialBppuReference.sourceSha256);

    const fkt = await exporter.mutateAdminTemplate(admin.sessionId, {
      action: "create",
      taxFamily: "PPN_FAKTUR_KELUARAN",
      versionTag: `FAKTUR-TEST-${randomUUID().slice(0, 6)}`,
      sourceUrl:
        "https://pajak.go.id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml",
      sourceLabel: "Unverified Faktur Placeholder",
      sourceSha256: "a".repeat(64),
      xsdSchemaHash: "b".repeat(64),
      fixtureVerified: true,
    });
    customTemplateIds.push(fkt.template.id);

    await expect(
      exporter.mutateAdminTemplate(admin.sessionId, {
        action: "set_status",
        templateId: fkt.template.id,
        status: "VERIFIED",
      }),
    ).rejects.toThrow("TEMPLATE_UNVERIFIED");
  });

  it("exports valid BPPU XML from approved snapshots, stores immutably, verifies checksums, and tracks manual Coretax outcomes", async () => {
    const owner = await createActor("OWNER");
    const preparer = await addMember(owner.organizationId, "PREPARER", true);
    const approver = await addMember(owner.organizationId, "APPROVER", false);
    const outsider = await createActor("APPROVER");
    const admin = await createActor("OWNER", "SUPERADMIN");

    const code = `BPPU-EXP-${randomUUID().slice(0, 6).toUpperCase()}`;
    const objCode = `SYNT-${randomUUID().slice(0, 6).toUpperCase()}`;
    const createdRule = (await tax.mutateRule(admin.sessionId, {
      action: "create",
      code,
      version: 1,
      taxFamily: "PPH_UNIFIKASI_BPPU",
      documentType: "SUPPLIER_INVOICE",
      objectCode: objCode,
      name: "Synthetic Export Rule",
      jurisdiction: "ID",
      effectiveFrom: "2026-01-01",
      rateNumerator: 2,
      rateDenominator: 100,
      roundingMode: "HALF_UP",
      requireCounterpartyIdentity: true,
      requirePayrollEvidence: false,
      requireTreatyEvidence: false,
      sourceCitation: "Synthetic SME Fixture Approval",
      catalogStatus: "SME_APPROVED",
      smeReviewedBy: "SME Export Reviewer",
    })) as { id: string };
    ruleIds.push(createdRule.id);

    const company = await intake.mutateCompany(owner.sessionId, {
      action: "create",
      company: {
        name: "PT Pemotong Uji",
        legalName: "PT Pemotong Uji",
        npwp: "0000000000000001",
        nitku: "0000000000000001000000",
      },
    });
    const cp = await intake.mutateCounterparty(owner.sessionId, {
      action: "create",
      counterparty: {
        kind: "VENDOR",
        name: "CV Penerima & Rekan",
        identityType: "NPWP",
        identity: "0000000000000002",
        countryCode: "ID",
      },
    });

    const createdTx = (await intake.createTransaction(preparer.sessionId, {
      action: "create",
      idempotencyKey: randomUUID(),
      draft: {
        companyId: company.id,
        counterpartyId: cp.id,
        taxFamily: "PPH_UNIFIKASI_BPPU",
        documentType: "SUPPLIER_INVOICE",
        invoiceNumber: 'INV/2026 & "01" <Uji>',
        documentDate: "2026-11-16",
        taxPeriod: "2026-11",
        currency: "IDR",
        lines: [
          {
            description: "Synthetic Consulting",
            quantity: "1",
            unitPrice: "10000000.00",
          },
        ],
      },
      acknowledgeDuplicates: false,
    })) as { transactionId: string };
    const txId = createdTx.transactionId;

    // Fails closed with TEMPLATE_UNVERIFIED for unsupported family requests.
    await expect(
      exporter.generateExport(preparer.sessionId, {
        companyId: company.id,
        taxFamily: "PPN_FAKTUR_KELUARAN",
        taxPeriod: "2026-11",
        transactionIds: [txId],
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow("TEMPLATE_UNVERIFIED");

    // Fails closed if transaction is not yet APPROVED.
    await expect(
      exporter.generateExport(preparer.sessionId, {
        companyId: company.id,
        taxFamily: "PPH_UNIFIKASI_BPPU",
        taxPeriod: "2026-11",
        transactionIds: [txId],
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow("NOT_APPROVED");

    await tax.executeReviewCommand(preparer.sessionId, txId, {
      action: "evaluate",
      objectCode: objCode,
    });
    const submitted = (await tax.executeReviewCommand(
      preparer.sessionId,
      txId,
      {
        action: "submit",
        version: 1,
      },
    )) as { version: number };
    await tax.executeReviewCommand(approver.sessionId, txId, {
      action: "approve",
      version: submitted.version,
    });

    // OWNER lacks tax.export permission.
    const idem1 = randomUUID();
    await expect(
      exporter.generateExport(owner.sessionId, {
        companyId: company.id,
        taxFamily: "PPH_UNIFIKASI_BPPU",
        taxPeriod: "2026-11",
        transactionIds: [txId],
        idempotencyKey: idem1,
      }),
    ).rejects.toThrow("FORBIDDEN");

    const exportV1 = await exporter.generateExport(preparer.sessionId, {
      companyId: company.id,
      taxFamily: "PPH_UNIFIKASI_BPPU",
      taxPeriod: "2026-11",
      transactionIds: [txId],
      idempotencyKey: idem1,
    });
    expect(exportV1.idempotentReplay).toBe(false);
    expect(exportV1.batch.exportVersion).toBe(1);
    expect(exportV1.batch.totalDppAmount).toBe("10000000.00");
    expect(exportV1.batch.totalTaxAmount).toBe("200000.00");

    // Idempotent replay returns existing batch cleanly.
    const replay = await exporter.generateExport(preparer.sessionId, {
      companyId: company.id,
      taxFamily: "PPH_UNIFIKASI_BPPU",
      taxPeriod: "2026-11",
      transactionIds: [txId],
      idempotencyKey: idem1,
    });
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.batch.id).toBe(exportV1.batch.id);

    // Download verifies SHA-256 and produces Schema3-compliant BPPU XML with XML escaping.
    const downloaded = await exporter.downloadExport(
      approver.sessionId,
      exportV1.batch.id,
    );
    const xmlText = new TextDecoder("utf-8").decode(downloaded.bytes);
    const parsedXml = validateBpuBulkXml(xmlText);
    expect(parsedXml.tin).toBe("0000000000000001");
    expect(parsedXml.items[0].taxBase).toBe("10000000");
    expect(parsedXml.items[0].rate).toBe("2");
    expect(parsedXml.items[0].documentNumber).toBe('INV/2026 & "01" <Uji>');
    expect(parsedXml.items[0].sp2dNumber).toBeNull();

    // Cross-tenant download fails closed.
    await expect(
      exporter.downloadExport(outsider.sessionId, exportV1.batch.id),
    ).rejects.toThrow("NOT_FOUND");

    // Workspace Owners may download generated XML (they already can export
    // all workspace data), even though they cannot generate XML.
    const ownerCopy = await exporter.downloadExport(
      owner.sessionId,
      exportV1.batch.id,
    );
    expect(ownerCopy.xmlSha256).toBe(downloaded.xmlSha256);

    // Regenerate creates immutable exportVersion=2 without overwriting v1.
    const exportV2 = await exporter.generateExport(approver.sessionId, {
      companyId: company.id,
      taxFamily: "PPH_UNIFIKASI_BPPU",
      taxPeriod: "2026-11",
      transactionIds: [txId],
      idempotencyKey: randomUUID(),
    });
    expect(exportV2.batch.exportVersion).toBe(2);
    expect(exportV2.batch.id).not.toBe(exportV1.batch.id);

    // Database BEFORE UPDATE trigger blocks any mutation to XmlExportBatch.
    await expect(
      db.$executeRaw`UPDATE "XmlExportBatch" SET "fileName" = 'tampered.xml' WHERE id = ${exportV1.batch.id}`,
    ).rejects.toThrow();

    // Tampering XML artifact on disk fails download integrity verification.
    const batchRow = await db.xmlExportBatch.findUniqueOrThrow({
      where: { id: exportV2.batch.id },
    });
    const storedPath = path.join(storageDir, ...batchRow.storageKey.split("/"));
    const originalBytes = readFileSync(storedPath);
    writeFileSync(
      storedPath,
      Buffer.concat([originalBytes, Buffer.from("\n<!-- tampered -->")]),
    );
    await expect(
      exporter.downloadExport(approver.sessionId, exportV2.batch.id),
    ).rejects.toThrow("INTEGRITY_MISMATCH");

    // Manual Coretax outcome recording transitions EXPORTED -> CORETAX_REJECTED
    // and supports controlled approver reopen -> CHANGES_REQUESTED.
    await exporter.recordOutcome(approver.sessionId, exportV1.batch.id, {
      outcome: "CORETAX_REJECTED",
      coretaxReference: "CT-ERR-001",
      notes: "Synthetic rejection test",
    });
    const rejectedTx = await db.transaction.findUniqueOrThrow({
      where: { id: txId },
    });
    expect(rejectedTx.status).toBe("CORETAX_REJECTED");

    const reopened = await tax.executeReviewCommand(approver.sessionId, txId, {
      action: "reopen",
      version: rejectedTx.version,
      reason: "Correcting recipient branch TKU after manual Coretax rejection",
    });
    expect(reopened.status).toBe("CHANGES_REQUESTED");
  });
});
