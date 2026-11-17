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
import { trialService } from "../../apps/web/src/server/trial/service";
import {
  jakartaDate,
  TRIAL_DURATION_MS,
} from "../../apps/web/src/server/trial/state";
import type { Role } from "../../apps/web/src/server/workspaces/policy";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Isolated _test database required");
const db = new PrismaClient({
  adapter: new PrismaPg({ ...postgresOptions(url), max: 15 }),
});
const storageDir = mkdtempSync(
  path.join(os.tmpdir(), "serentax-intake-integration-"),
);
const crypto = createTaxCrypto(
  "synthetic-integration-tax-secret-key-0123456789",
);
const storage = localDocumentStorage(storageDir);
const intake = intakeService(db, crypto, storage);
const trials = trialService(db);
const users: string[] = [];
const orgs: string[] = [];

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
      name: "Synthetic intake org",
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

async function seedMasters(organizationId: string, ownerSessionId: string) {
  const company = await intake.mutateCompany(ownerSessionId, {
    action: "create",
    company: {
      name: "Synthetic Head Office",
      legalName: "PT Synthetic Example",
      npwp: "01.234.567.8-901.000",
      nitku: "0123456789012345000001",
    },
  });
  const counterparty = await intake.mutateCounterparty(ownerSessionId, {
    action: "create",
    counterparty: {
      kind: "VENDOR",
      name: "PT Synthetic Vendor",
      identityType: "NPWP",
      identity: "9876543210987654",
      countryCode: "ID",
    },
  });
  return {
    companyId: company.id,
    counterpartyId: counterparty.id,
    organizationId,
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

describe("intake integration on real PostgreSQL", () => {
  it("encrypts company and counterparty tax identifiers at rest and blocks duplicate NITKU/NPWP", async () => {
    const owner = await createActor("OWNER");
    const preparerSession = await addSession(
      (await createActor("PREPARER")).userId,
      owner.organizationId,
      "PREPARER",
    );
    await expect(
      intake.mutateCompany(preparerSession, {
        action: "create",
        company: { name: "Unauthorized", legalName: "Unauthorized" },
      }),
    ).rejects.toThrow("FORBIDDEN");

    const masters = await seedMasters(owner.organizationId, owner.sessionId);
    const rawCompany = await db.company.findUniqueOrThrow({
      where: { id: masters.companyId },
    });
    expect(rawCompany.npwpCipher).not.toContain("012345678901000");
    expect(rawCompany.nitkuCipher).not.toContain("0123456789012345000001");
    expect(rawCompany.npwpHint).toBe("1000");
    expect(rawCompany.nitkuHint).toBe("0001");

    await expect(
      intake.mutateCompany(owner.sessionId, {
        action: "create",
        company: {
          name: "Duplicate NITKU branch",
          legalName: "PT Synthetic Example",
          nitku: "0123456789012345-000001",
        },
      }),
    ).rejects.toThrow("DUPLICATE_COMPANY_NITKU");

    await expect(
      intake.mutateCounterparty(preparerSession, {
        action: "create",
        counterparty: {
          kind: "VENDOR",
          name: "Duplicate identity vendor",
          identityType: "NPWP",
          identity: "9876543210987654",
          countryCode: "ID",
        },
      }),
    ).rejects.toThrow("DUPLICATE_COUNTERPARTY_IDENTITY");

    const sameName = await intake.mutateCounterparty(preparerSession, {
      action: "create",
      counterparty: {
        kind: "VENDOR",
        name: "  pt synthetic   vendor ",
        identityType: "NONE",
        countryCode: "ID",
      },
    });
    expect(sameName.duplicateNames).toHaveLength(1);
  });

  it("creates a manual draft atomically with quota, supports idempotent replay, and does not refund on edit or void", async () => {
    const owner = await createActor("OWNER");
    const masters = await seedMasters(owner.organizationId, owner.sessionId);
    const preparer = await createActor("PREPARER");
    const session = await addSession(
      preparer.userId,
      owner.organizationId,
      "PREPARER",
    );
    await trials.activate(session);

    const draft = {
      companyId: masters.companyId,
      counterpartyId: masters.counterpartyId,
      taxFamily: "PPH_UNIFIKASI_BPPU" as const,
      documentType: "SUPPLIER_INVOICE" as const,
      invoiceNumber: "INV-2026-001",
      documentDate: "2026-11-16",
      taxPeriod: "2026-11",
      currency: "IDR" as const,
      description: "Synthetic consulting invoice",
      lines: [
        { description: "Phase 1", quantity: "2.5", unitPrice: "100000.00" },
        { description: "Phase 2", quantity: "1", unitPrice: "50000.50" },
      ],
    };
    const key = randomUUID();
    const created = (await intake.createTransaction(session, {
      action: "create",
      idempotencyKey: key,
      draft,
      acknowledgeDuplicates: false,
    })) as { transactionId: string; replay: boolean };
    expect(created.replay).toBe(false);

    const replay = (await intake.createTransaction(session, {
      action: "create",
      idempotencyKey: key,
      draft,
      acknowledgeDuplicates: false,
    })) as { transactionId: string; replay: boolean };
    expect(replay).toEqual({
      transactionId: created.transactionId,
      replay: true,
    });
    expect((await trials.snapshot(session)).usedTotal).toBe(1);
    expect((await trials.snapshot(session)).remainingToday).toBe(0);

    const detail = await intake.getTransaction(session, created.transactionId);
    expect(detail.transaction.totalAmount).toBe("300000.50");
    expect(detail.transaction.version).toBe(1);

    await intake.mutateTransaction(session, created.transactionId, {
      action: "update",
      version: 1,
      draft: {
        ...draft,
        lines: [
          { description: "Revised", quantity: "3", unitPrice: "100000.00" },
        ],
      },
      acknowledgeDuplicates: false,
    });
    await expect(
      intake.mutateTransaction(session, created.transactionId, {
        action: "update",
        version: 1,
        draft,
        acknowledgeDuplicates: false,
      }),
    ).rejects.toThrow("STALE_VERSION");

    await intake.mutateTransaction(session, created.transactionId, {
      action: "comment",
      body: "Synthetic reviewer note",
    });
    await intake.mutateTransaction(session, created.transactionId, {
      action: "void",
      version: 2,
      reason: "Entered in wrong workspace",
    });
    await expect(
      intake.mutateTransaction(session, created.transactionId, {
        action: "update",
        version: 3,
        draft,
        acknowledgeDuplicates: false,
      }),
    ).rejects.toThrow("INVALID_STATE");

    // Voiding must not restore daily or lifetime trial allowance.
    expect((await trials.snapshot(session)).usedTotal).toBe(1);
    expect((await trials.snapshot(session)).remainingToday).toBe(0);
    await expect(
      intake.createTransaction(session, {
        action: "create",
        idempotencyKey: randomUUID(),
        draft: { ...draft, invoiceNumber: "INV-2026-002" },
        acknowledgeDuplicates: false,
      }),
    ).rejects.toThrow("DAILY_LIMIT");
  });

  it("rolls back quota when duplicate warnings are unacknowledged, then allows acknowledged creation", async () => {
    const owner = await createActor("OWNER");
    const masters = await seedMasters(owner.organizationId, owner.sessionId);
    const firstPreparer = await createActor("PREPARER");
    const firstSession = await addSession(
      firstPreparer.userId,
      owner.organizationId,
      "PREPARER",
    );
    await trials.activate(firstSession);

    const draft = {
      companyId: masters.companyId,
      counterpartyId: masters.counterpartyId,
      taxFamily: "UNCLASSIFIED" as const,
      documentType: "SUPPLIER_INVOICE" as const,
      invoiceNumber: "DUP-100",
      documentDate: "2026-11-16",
      taxPeriod: "2026-11",
      currency: "IDR" as const,
      lines: [{ description: "Item", quantity: "1", unitPrice: "75000.00" }],
    };
    await intake.createTransaction(firstSession, {
      action: "create",
      idempotencyKey: randomUUID(),
      draft,
      acknowledgeDuplicates: false,
    });

    const secondPreparer = await createActor("PREPARER");
    const secondSession = await addSession(
      secondPreparer.userId,
      owner.organizationId,
      "PREPARER",
    );
    await trials.activate(secondSession);

    await expect(
      intake.createTransaction(secondSession, {
        action: "create",
        idempotencyKey: randomUUID(),
        draft: { ...draft, invoiceNumber: " dup 100 " },
        acknowledgeDuplicates: false,
      }),
    ).rejects.toThrow("DUPLICATE_WARNING");

    // Because duplicate warning threw inside the callback, zero trial quota was consumed.
    expect((await trials.snapshot(secondSession)).usedTotal).toBe(0);
    expect((await trials.snapshot(secondSession)).remainingToday).toBe(1);

    const acknowledged = (await intake.createTransaction(secondSession, {
      action: "create",
      idempotencyKey: randomUUID(),
      draft: { ...draft, invoiceNumber: " dup 100 " },
      acknowledgeDuplicates: true,
    })) as { transactionId: string };
    expect((await trials.snapshot(secondSession)).usedTotal).toBe(1);

    const list = await intake.listTransactions(secondSession, {});
    expect(
      list.transactions.find((row) => row.id === acknowledged.transactionId)
        ?.hasDuplicate,
    ).toBe(true);
  });

  it("allows only one creation across 10 concurrent intake requests and enforces the 3-total cap", async () => {
    const owner = await createActor("OWNER");
    const masters = await seedMasters(owner.organizationId, owner.sessionId);
    const preparer = await createActor("PREPARER");
    const session = await addSession(
      preparer.userId,
      owner.organizationId,
      "PREPARER",
    );
    const expiresAt = new Date(Date.now() + 3600000);
    await db.trialAccount.create({
      data: {
        userId: preparer.userId,
        activatedAt: new Date(expiresAt.getTime() - TRIAL_DURATION_MS),
        expiresAt,
      },
    });
    for (const [daysAgo, slot] of [
      [2, 1],
      [1, 2],
    ] as const) {
      const at = new Date(Date.now() - daysAgo * 86400000);
      await db.trialUsage.create({
        data: {
          userId: preparer.userId,
          organizationId: owner.organizationId,
          idempotencyKey: randomUUID(),
          transactionId: randomUUID(),
          requestHash: "0".repeat(64),
          jakartaDate: jakartaDate(at),
          createdAt: at,
          slot,
        },
      });
    }

    const baseDraft = {
      companyId: masters.companyId,
      counterpartyId: masters.counterpartyId,
      taxFamily: "UNCLASSIFIED" as const,
      documentType: "SUPPLIER_INVOICE" as const,
      documentDate: "2026-11-16",
      taxPeriod: "2026-11",
      currency: "IDR" as const,
      lines: [{ description: "Concurrent", quantity: "1", unitPrice: "10.00" }],
    };
    const outcomes = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) =>
        intake.createTransaction(session, {
          action: "create",
          idempotencyKey: randomUUID(),
          draft: { ...baseDraft, invoiceNumber: `CONC-${index}` },
          acknowledgeDuplicates: true,
        }),
      ),
    );
    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    expect((await trials.snapshot(session)).state).toBe("TOTAL_LIMIT");
    await expect(
      intake.createTransaction(session, {
        action: "create",
        idempotencyKey: randomUUID(),
        draft: { ...baseDraft, invoiceNumber: "CONC-EXTRA" },
        acknowledgeDuplicates: true,
      }),
    ).rejects.toThrow("TOTAL_LIMIT");
  });

  it("enforces tenant isolation on masters, transactions and private documents", async () => {
    const ownerA = await createActor("OWNER");
    const mastersA = await seedMasters(ownerA.organizationId, ownerA.sessionId);
    const preparerA = await addSession(
      ownerA.userId,
      ownerA.organizationId,
      "PREPARER",
    );
    await trials.activate(preparerA);

    const created = (await intake.createTransaction(preparerA, {
      action: "create",
      idempotencyKey: randomUUID(),
      draft: {
        companyId: mastersA.companyId,
        counterpartyId: mastersA.counterpartyId,
        taxFamily: "UNCLASSIFIED",
        documentType: "SUPPLIER_INVOICE",
        invoiceNumber: "TENANT-A-1",
        documentDate: "2026-11-16",
        taxPeriod: "2026-11",
        currency: "IDR",
        lines: [{ description: "Line", quantity: "1", unitPrice: "50.00" }],
      },
      acknowledgeDuplicates: false,
    })) as { transactionId: string };

    const pdf = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34,
    ]);
    const doc = await intake.attachDocument(preparerA, created.transactionId, {
      bytes: pdf,
      declaredType: "application/pdf",
      fileName: "source.pdf",
    });
    await expect(
      intake.attachDocument(preparerA, created.transactionId, {
        bytes: pdf,
        declaredType: "application/pdf",
        fileName: "duplicate.pdf",
      }),
    ).rejects.toThrow("DUPLICATE_DOCUMENT");

    const loaded = await intake.readDocument(
      preparerA,
      created.transactionId,
      doc.id,
    );
    expect(Array.from(loaded.bytes)).toEqual(Array.from(pdf));

    // Tenant B cannot read, mutate, reference or download Tenant A's records.
    const ownerB = await createActor("OWNER");
    const mastersB = await seedMasters(ownerB.organizationId, ownerB.sessionId);
    const preparerB = await addSession(
      ownerB.userId,
      ownerB.organizationId,
      "PREPARER",
    );
    await trials.activate(preparerB);

    await expect(
      intake.getTransaction(preparerB, created.transactionId),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      intake.readDocument(preparerB, created.transactionId, doc.id),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      intake.mutateTransaction(preparerB, created.transactionId, {
        action: "comment",
        body: "cross-tenant attempt",
      }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      intake.createTransaction(preparerB, {
        action: "create",
        idempotencyKey: randomUUID(),
        draft: {
          companyId: mastersA.companyId,
          counterpartyId: mastersB.counterpartyId,
          taxFamily: "UNCLASSIFIED",
          documentType: "SUPPLIER_INVOICE",
          invoiceNumber: "CROSS-REF",
          documentDate: "2026-11-16",
          taxPeriod: "2026-11",
          currency: "IDR",
          lines: [{ description: "Line", quantity: "1", unitPrice: "50.00" }],
        },
        acknowledgeDuplicates: false,
      }),
    ).rejects.toThrow("VALIDATION_FAILED");
    expect((await trials.snapshot(preparerB)).usedTotal).toBe(0);
  });
});
