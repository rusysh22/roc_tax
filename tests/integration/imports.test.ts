import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { postgresOptions } from "../../apps/web/src/server/postgres";
import { PrismaClient } from "../../apps/web/src/generated/prisma/client";
import { createTaxCrypto } from "../../apps/web/src/server/intake/crypto";
import { importBatchService } from "../../apps/web/src/server/intake/imports";
import { intakeService } from "../../apps/web/src/server/intake/service";
import {
  serializeCsv,
  serializeXlsx,
} from "../../apps/web/src/server/intake/spreadsheet";
import { localDocumentStorage } from "../../apps/web/src/server/intake/storage";
import { trialService } from "../../apps/web/src/server/trial/service";
import {
  templateHeaders,
  importColumns,
} from "../../apps/web/src/lib/intake/spreadsheet";
import type { Role } from "../../apps/web/src/server/workspaces/policy";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Isolated _test database required");
const db = new PrismaClient({
  adapter: new PrismaPg({ ...postgresOptions(url), max: 15 }),
});
const storageDir = mkdtempSync(
  path.join(os.tmpdir(), "serentax-imports-integration-"),
);
const crypto = createTaxCrypto(
  "synthetic-imports-integration-secret-0123456789",
);
const intake = intakeService(db, crypto, localDocumentStorage(storageDir));
const imports = importBatchService(db, crypto);
const trials = trialService(db);
const users: string[] = [];
const orgs: string[] = [];

const headers = importColumns.map((c) => templateHeaders[c]);

async function createActor(role: Role = "PREPARER") {
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
  const org = await db.organization.create({
    data: {
      name: "Synthetic import org",
      legalName: "Synthetic legal entity",
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

async function addSession(userId: string, organizationId: string, role: Role) {
  await db.membership.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    update: { role },
    create: { organizationId, userId, role },
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
  return sessionId;
}

async function setupWorkspace() {
  const owner = await createActor("OWNER");
  const company = await intake.mutateCompany(owner.sessionId, {
    action: "create",
    company: {
      name: "Synthetic Import Branch",
      legalName: "PT Synthetic Import",
      npwp: "01.234.567.8-901.000",
    },
  });
  await intake.mutateCounterparty(owner.sessionId, {
    action: "create",
    counterparty: {
      kind: "VENDOR",
      name: "PT Synthetic Supplier",
      identityType: "NPWP",
      identity: "9876543210987654",
      countryCode: "ID",
    },
  });
  const preparer = await createActor("PREPARER");
  const session = await addSession(
    preparer.userId,
    owner.organizationId,
    "PREPARER",
  );
  await trials.activate(session);
  return {
    organizationId: owner.organizationId,
    companyId: company.id,
    preparer,
    session,
  };
}

afterAll(async () => {
  await db.trialUsage.deleteMany({ where: { userId: { in: users } } });
  await db.trialAccount.deleteMany({ where: { userId: { in: users } } });
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
  rmSync(storageDir, { recursive: true, force: true });
});

describe("spreadsheet import integration on real PostgreSQL", () => {
  it("evaluates mixed valid/invalid/formula rows, exports sanitized error CSV, and commits the valid row", async () => {
    const ws = await setupWorkspace();
    const csvBytes = new TextEncoder().encode(
      serializeCsv([
        headers,
        [
          "IMP-MIX-001",
          "2026-11-16",
          "2026-11",
          "SUPPLIER_INVOICE",
          "PPH_UNIFIKASI_BPPU",
          "PT Synthetic Supplier",
          "9876543210987654",
          "Valid import row",
          "Consulting fee",
          "2",
          "125000.00",
          "IDR",
        ],
        [
          "IMP-MIX-002",
          "2026-11-16",
          "2026-11",
          "SUPPLIER_INVOICE",
          "PPH21_BP21",
          "Unknown Vendor",
          "",
          "Invalid row",
          "Payroll item",
          "0.3333",
          "10.00",
          "USD",
        ],
      ]),
    );

    const preview = await imports.preview(ws.session, {
      companyId: ws.companyId,
      fileName: "mixed.csv",
      bytes: csvBytes,
    });
    expect(preview.totalRows).toBe(2);
    expect(preview.validRows).toBe(1);
    expect(preview.invalidRows).toBe(1);
    expect(preview.eligibleToCommit).toBe(true);
    expect(preview.errorReportCsv).toContain("IMP-MIX-002");
    expect(preview.errorReportCsv).toContain("BLOCKED_TAX_FAMILY");
    expect(preview.errorReportCsv).toContain("LINE_PRECISION");

    const batchKey = randomUUID();
    const committed = await imports.commit(ws.session, {
      idempotencyKey: batchKey,
      companyId: ws.companyId,
      fileName: "mixed.csv",
      bytes: csvBytes,
      acknowledgeDuplicates: false,
    });
    expect(committed.createdCount).toBe(1);
    expect(committed.replay).toBe(false);
    expect((await trials.snapshot(ws.session)).usedTotal).toBe(1);

    // Idempotent retry returns the same batch & transaction without consuming more quota.
    const replay = await imports.commit(ws.session, {
      idempotencyKey: batchKey,
      companyId: ws.companyId,
      fileName: "mixed.csv",
      bytes: csvBytes,
      acknowledgeDuplicates: false,
    });
    expect(replay).toEqual({ ...committed, replay: true });
    expect((await trials.snapshot(ws.session)).usedTotal).toBe(1);

    // Reusing the same idempotencyKey with a different file fails closed.
    const alteredBytes = new TextEncoder().encode(
      serializeCsv([
        headers,
        [
          "IMP-MIX-999",
          "2026-11-16",
          "2026-11",
          "SUPPLIER_INVOICE",
          "UNCLASSIFIED",
          "PT Synthetic Supplier",
          "",
          "",
          "Line",
          "1",
          "10.00",
          "IDR",
        ],
      ]),
    );
    await expect(
      imports.commit(ws.session, {
        idempotencyKey: batchKey,
        companyId: ws.companyId,
        fileName: "mixed.csv",
        bytes: alteredBytes,
        acknowledgeDuplicates: false,
      }),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");

    const history = await imports.listBatches(ws.session);
    expect(history.batches).toHaveLength(1);
    expect(history.batches[0].id).toBe(committed.batchId);
  });

  it("blocks multi-valid-row imports up front under trial quota without partial writes", async () => {
    const ws = await setupWorkspace();
    const xlsxBytes = serializeXlsx([
      headers,
      [
        "IMP-TWO-1",
        "2026-11-16",
        "2026-11",
        "SUPPLIER_INVOICE",
        "UNCLASSIFIED",
        "PT Synthetic Supplier",
        "9876543210987654",
        "",
        "Line 1",
        "1",
        "50000.00",
        "IDR",
      ],
      [
        "IMP-TWO-2",
        "2026-11-16",
        "2026-11",
        "SUPPLIER_INVOICE",
        "UNCLASSIFIED",
        "PT Synthetic Supplier",
        "9876543210987654",
        "",
        "Line 2",
        "1",
        "60000.00",
        "IDR",
      ],
    ]);

    const preview = await imports.preview(ws.session, {
      companyId: ws.companyId,
      fileName: "two-rows.xlsx",
      bytes: xlsxBytes,
    });
    expect(preview.validRows).toBe(2);
    expect(preview.eligibleToCommit).toBe(false);
    expect(preview.quotaBlockReason).toBe("TRIAL_SINGLE_ROW_LIMIT");

    await expect(
      imports.commit(ws.session, {
        idempotencyKey: randomUUID(),
        companyId: ws.companyId,
        fileName: "two-rows.xlsx",
        bytes: xlsxBytes,
        acknowledgeDuplicates: false,
      }),
    ).rejects.toThrow("TRIAL_SINGLE_ROW_LIMIT");

    expect((await trials.snapshot(ws.session)).usedTotal).toBe(0);
    expect(
      await db.transaction.count({
        where: { organizationId: ws.organizationId },
      }),
    ).toBe(0);
  });

  it("allows only 1 batch across 10 concurrent spreadsheet imports and blocks cross-tenant access", async () => {
    const ws = await setupWorkspace();
    const makeCsv = (index: number) =>
      new TextEncoder().encode(
        serializeCsv([
          headers,
          [
            `IMP-CONC-${index}`,
            "2026-11-16",
            "2026-11",
            "SUPPLIER_INVOICE",
            "UNCLASSIFIED",
            "PT Synthetic Supplier",
            "9876543210987654",
            "",
            "Concurrent line",
            "1",
            "10000.00",
            "IDR",
          ],
        ]),
      );

    const outcomes = await Promise.allSettled(
      Array.from({ length: 10 }, (_, idx) =>
        imports.commit(ws.session, {
          idempotencyKey: randomUUID(),
          companyId: ws.companyId,
          fileName: `conc-${idx}.csv`,
          bytes: makeCsv(idx),
          acknowledgeDuplicates: true,
        }),
      ),
    );
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect((await trials.snapshot(ws.session)).usedTotal).toBe(1);
    expect(
      await db.importBatch.count({
        where: { organizationId: ws.organizationId },
      }),
    ).toBe(1);

    // Another tenant cannot import into ws.companyId or read ws's batches.
    const other = await setupWorkspace();
    await expect(
      imports.preview(other.session, {
        companyId: ws.companyId,
        fileName: "cross.csv",
        bytes: makeCsv(99),
      }),
    ).rejects.toThrow("UNKNOWN_COMPANY");
    expect((await imports.listBatches(other.session)).batches).toHaveLength(0);
  });
});
