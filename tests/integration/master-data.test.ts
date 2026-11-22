import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { postgresOptions } from "../../apps/web/src/server/postgres";
import { PrismaClient } from "../../apps/web/src/generated/prisma/client";
import { createTaxCrypto } from "../../apps/web/src/server/intake/crypto";
import { intakeService } from "../../apps/web/src/server/intake/service";
import { importBatchService } from "../../apps/web/src/server/intake/imports";
import { localDocumentStorage } from "../../apps/web/src/server/intake/storage";
import { trialService } from "../../apps/web/src/server/trial/service";
import type { Role } from "../../apps/web/src/server/workspaces/policy";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Isolated _test database required");
const db = new PrismaClient({
  adapter: new PrismaPg({ ...postgresOptions(url), max: 10 }),
});
const crypto = createTaxCrypto("synthetic-master-data-secret-0123456789abc");
const intake = intakeService(db, crypto, localDocumentStorage());
const imports = importBatchService(db, crypto);
const trials = trialService(db);
const users: string[] = [];
const orgs: string[] = [];

async function member(organizationId: string | null, role: Role) {
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
  let orgId = organizationId;
  if (!orgId) {
    const org = await db.organization.create({
      data: { name: "Synthetic Master Data", legalName: "PT Synthetic MD" },
    });
    orgs.push(org.id);
    orgId = org.id;
  }
  await db.membership.create({ data: { organizationId: orgId, userId, role } });
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

afterAll(async () => {
  await db.trialUsage.deleteMany({ where: { userId: { in: users } } });
  await db.trialAccount.deleteMany({ where: { userId: { in: users } } });
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

describe("standard CRUD: archive, delete and list filters on PostgreSQL", () => {
  it("archives counterparties, blocks them on new drafts, and only deletes unused master data", async () => {
    const owner = await member(null, "OWNER");
    const preparer = await member(owner.organizationId, "PREPARER");
    const company = await intake.mutateCompany(owner.sessionId, {
      action: "create",
      company: { name: "PT Arsip", legalName: "PT Arsip" },
    });
    const unusedCompany = await intake.mutateCompany(owner.sessionId, {
      action: "create",
      company: { name: "PT Kosong", legalName: "PT Kosong" },
    });
    const used = (await intake.mutateCounterparty(preparer.sessionId, {
      action: "create",
      counterparty: {
        kind: "VENDOR",
        name: "CV Dipakai",
        identityType: "NONE",
        countryCode: "ID",
      },
    })) as { id: string };
    const spare = (await intake.mutateCounterparty(preparer.sessionId, {
      action: "create",
      counterparty: {
        kind: "VENDOR",
        name: "CV Cadangan",
        identityType: "NONE",
        countryCode: "ID",
      },
    })) as { id: string };

    await trials.activate(preparer.sessionId);
    await intake.createTransaction(preparer.sessionId, {
      action: "create",
      idempotencyKey: randomUUID(),
      acknowledgeDuplicates: false,
      draft: {
        companyId: company.id,
        counterpartyId: used.id,
        taxFamily: "UNCLASSIFIED",
        documentType: "SUPPLIER_INVOICE",
        invoiceNumber: "MD-1",
        documentDate: "2026-11-16",
        taxPeriod: "2026-11",
        currency: "IDR",
        lines: [{ description: "Jasa", quantity: "1", unitPrice: "1000.00" }],
      },
    });

    // Referenced records cannot be hard-deleted.
    await expect(
      intake.mutateCounterparty(preparer.sessionId, {
        action: "delete",
        id: used.id,
      }),
    ).rejects.toThrow("IN_USE");
    await expect(
      intake.mutateCompany(owner.sessionId, {
        action: "delete",
        id: company.id,
      }),
    ).rejects.toThrow("IN_USE");
    // Unused records can.
    await intake.mutateCompany(owner.sessionId, {
      action: "delete",
      id: unusedCompany.id,
    });
    expect(await db.company.count({ where: { id: unusedCompany.id } })).toBe(0);

    // Archive toggles; archived records are hidden by default and refused on new drafts.
    await intake.mutateCounterparty(preparer.sessionId, {
      action: "archive",
      id: spare.id,
    });
    const active = await intake.listCounterparties(preparer.sessionId, {});
    expect(active.counterparties.map((c) => c.id)).not.toContain(spare.id);
    const archived = await intake.listCounterparties(preparer.sessionId, {
      archived: "only",
    });
    expect(archived.counterparties.map((c) => c.id)).toEqual([spare.id]);
    const byId = await intake.listCounterparties(preparer.sessionId, {
      id: spare.id,
    });
    expect(byId.counterparties[0]?.archivedAt).not.toBeNull();
    await expect(
      intake.checkDraft(preparer.sessionId, {
        companyId: company.id,
        counterpartyId: spare.id,
        taxFamily: "UNCLASSIFIED",
        documentType: "SUPPLIER_INVOICE",
        invoiceNumber: "MD-2",
        documentDate: "2026-11-16",
        taxPeriod: "2026-11",
        currency: "IDR",
        lines: [{ description: "Jasa", quantity: "1", unitPrice: "2000.00" }],
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      details: {
        issues: [{ path: "counterpartyId", code: "ARCHIVED_COUNTERPARTY" }],
      },
    });
    await intake.mutateCounterparty(preparer.sessionId, {
      action: "archive",
      id: spare.id,
    });
    expect(
      (
        await intake.listCounterparties(preparer.sessionId, {})
      ).counterparties.map((c) => c.id),
    ).toContain(spare.id);
    await intake.mutateCounterparty(preparer.sessionId, {
      action: "delete",
      id: spare.id,
    });
    expect(await db.counterparty.count({ where: { id: spare.id } })).toBe(0);

    // Reviewers cannot maintain counterparties.
    const reviewer = await member(owner.organizationId, "REVIEWER");
    await expect(
      intake.mutateCounterparty(reviewer.sessionId, {
        action: "archive",
        id: used.id,
      }),
    ).rejects.toThrow("FORBIDDEN");

    // Multi-value transaction filters, exclusions, sort and the 80-row page size.
    const all = await intake.listTransactions(preparer.sessionId, {
      pageSize: "80",
    });
    expect(all.total).toBe(1);
    expect(all.transactions[0]).toMatchObject({
      invoiceNumber: "MD-1",
      version: 1,
    });
    expect(
      (
        await intake.listTransactions(preparer.sessionId, {
          statuses: "DRAFT,VALIDATED",
        })
      ).total,
    ).toBe(1);
    expect(
      (
        await intake.listTransactions(preparer.sessionId, {
          excludeStatuses: "DRAFT",
        })
      ).total,
    ).toBe(0);
    expect(
      (
        await intake.listTransactions(preparer.sessionId, {
          families: "PPH_UNIFIKASI_BPPU",
        })
      ).total,
    ).toBe(0);
    expect(
      (
        await intake.listTransactions(preparer.sessionId, {
          counterparty: "dipakai",
          taxPeriods: "2026-11",
          sort: "amount:desc",
        })
      ).total,
    ).toBe(1);
    expect(
      (
        await intake.listTransactions(preparer.sessionId, {
          dateFrom: "2026-11-17",
        })
      ).total,
    ).toBe(0);
    await expect(
      intake.listTransactions(preparer.sessionId, { sort: "drop table:asc" }),
    ).rejects.toThrow();

    // Import history can be fetched per batch id (tenant-scoped).
    const history = await imports.listBatches(preparer.sessionId, randomUUID());
    expect(history.batches).toHaveLength(0);
  });
});
