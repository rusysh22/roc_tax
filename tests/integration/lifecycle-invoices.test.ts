import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { postgresOptions } from "../../apps/web/src/server/postgres";
import { PrismaClient } from "../../apps/web/src/generated/prisma/client";
import { createTaxCrypto } from "../../apps/web/src/server/intake/crypto";
import { intakeService } from "../../apps/web/src/server/intake/service";
import { localDocumentStorage } from "../../apps/web/src/server/intake/storage";
import { lifecycleService } from "../../apps/web/src/server/lifecycle/service";
import {
  invoicingService,
  type SellerConfig,
} from "../../apps/web/src/server/invoicing/service";
import { salesService } from "../../apps/web/src/server/sales/service";
import { jakartaDate } from "../../apps/web/src/server/trial/state";
import type { Role } from "../../apps/web/src/server/workspaces/policy";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Isolated _test database required");
const db = new PrismaClient({
  adapter: new PrismaPg({ ...postgresOptions(url), max: 10 }),
});
const crypto = createTaxCrypto("synthetic-lifecycle-secret-0123456789abcd");
const sales = salesService(db, crypto, { pepper: "synthetic" });
const seller: SellerConfig = {
  name: "PT Penerbit Sintetis",
  npwp: null,
  address: "Jl. Uji No. 1, Jakarta",
  email: null,
  bankName: "Bank Sintetis",
  bankAccountNo: "0000000000",
  bankAccountName: "PT Penerbit Sintetis",
  prefix: `INV/TEST${Date.now().toString().slice(-6)}`,
};
let storageDir = "";
let storage: ReturnType<typeof localDocumentStorage>;
let intake: ReturnType<typeof intakeService>;

const users: string[] = [];
const orgs: string[] = [];

async function addUser(
  organizationId: string | null,
  role: Role,
  superadmin = false,
) {
  const userId = randomUUID();
  users.push(userId);
  await db.user.create({
    data: {
      id: userId,
      name: `Synthetic ${role}`,
      email: `${userId}@example.test`,
      emailVerified: true,
      platformRole: superadmin ? "SUPERADMIN" : "NONE",
    },
  });
  let orgId = organizationId;
  if (!orgId) {
    const org = await db.organization.create({
      data: {
        name: "Synthetic Lifecycle Org",
        legalName: "PT Synthetic Lifecycle",
      },
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

let seq = 9000;
async function workspaceWithOffer(
  admin: { sessionId: string },
  offer: Record<string, unknown> = {},
) {
  const owner = await addUser(null, "OWNER");
  const preparer = await addUser(owner.organizationId, "PREPARER");
  await sales.adminCommand(admin.sessionId, {
    action: "offer_upsert",
    organizationId: owner.organizationId,
    pricingModel: "PER_INVOICE",
    pricePerInvoiceIdr: "2500.00",
    minimumMonthlyIdr: "0.00",
    vatRatePercent: "11",
    paymentTermDays: 14,
    monthlyInvoiceCap: null,
    offerReference: "SYN/OFFER/LC",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    active: true,
    notes: "",
    ...offer,
  });
  const company = await intake.mutateCompany(owner.sessionId, {
    action: "create",
    company: { name: "PT Siklus Uji", legalName: "PT Siklus Uji" },
  });
  const counterparty = (await intake.mutateCounterparty(owner.sessionId, {
    action: "create",
    counterparty: {
      kind: "VENDOR",
      name: "CV Siklus",
      identityType: "NPWP",
      identity: "0000000000000055",
      countryCode: "ID",
    },
  })) as { id: string };
  const create = (invoiceNumber: string) =>
    intake.createTransaction(preparer.sessionId, {
      action: "create",
      idempotencyKey: randomUUID(),
      acknowledgeDuplicates: false,
      draft: {
        companyId: company.id,
        counterpartyId: counterparty.id,
        taxFamily: "PPH_UNIFIKASI_BPPU",
        documentType: "SUPPLIER_INVOICE",
        invoiceNumber,
        documentDate: "2026-11-16",
        taxPeriod: "2026-11",
        currency: "IDR",
        lines: [
          { description: "Jasa", quantity: "1", unitPrice: `${seq++}.00` },
        ],
      },
    }) as Promise<{ transactionId: string }>;
  return { owner, preparer, create };
}

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(tmpdir(), "serentax-lifecycle-"));
  storage = localDocumentStorage(storageDir);
  intake = intakeService(db, crypto, storage);
});

afterAll(async () => {
  await db.entitledUsage.deleteMany({
    where: { organizationId: { in: orgs } },
  });
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await rm(storageDir, { recursive: true, force: true });
  await db.$disconnect();
});

describe("subscription termination and automatic deletion", () => {
  it("runs request → cancel → terminate (read-only) → purge after retention", async () => {
    const admin = await addUser(null, "OWNER", true);
    const ws = await workspaceWithOffer(admin);
    const lifecycle = lifecycleService(db, storage, {
      noticeDays: 30,
      retentionDays: 90,
      suspendAfterOverdueDays: null,
    });
    const tx = await ws.create("LC-1");
    const doc = await intake.attachDocument(
      ws.preparer.sessionId,
      tx.transactionId,
      {
        bytes: Buffer.from("%PDF-1.4\nINVOICE:LC-1\n", "utf-8"),
        declaredType: "application/pdf",
        fileName: "lc.pdf",
      },
    );

    await expect(lifecycle.request(ws.preparer.sessionId, {})).rejects.toThrow(
      "OWNER_ONLY",
    );
    const requested = await lifecycle.request(ws.owner.sessionId, {
      reason: "uji",
    });
    expect(requested.status).toBe("REQUESTED");
    await expect(lifecycle.request(ws.owner.sessionId, {})).rejects.toThrow(
      "ALREADY_REQUESTED",
    );
    // During the notice period the workspace keeps working, and can withdraw.
    await ws.create("LC-2");
    await lifecycle.cancel(ws.owner.sessionId);
    await lifecycle.request(ws.owner.sessionId, {});

    // Notice period over → read-only.
    const in31Days = new Date(Date.now() + 31 * 86400000);
    const first = await lifecycle.runScheduled(in31Days);
    expect(first.terminated).toBeGreaterThanOrEqual(1);
    await expect(ws.create("LC-3")).rejects.toThrow("WORKSPACE_TERMINATED");
    await expect(
      intake.attachDocument(ws.preparer.sessionId, tx.transactionId, {
        bytes: Buffer.from("%PDF-1.4\nINVOICE:LC-3\n", "utf-8"),
        declaredType: "application/pdf",
        fileName: "late.pdf",
      }),
    ).rejects.toThrow("WORKSPACE_TERMINATED");
    // Data is still readable until the purge.
    expect(
      (
        await intake.readDocument(
          ws.preparer.sessionId,
          tx.transactionId,
          doc.id,
        )
      ).bytes.length,
    ).toBeGreaterThan(0);
    const status = await lifecycle.status(ws.owner.sessionId);
    expect(status.termination?.status).toBe("TERMINATED");
    expect(status.termination?.purgeAfter).not.toBeNull();

    // Retention over → documents deleted, records kept.
    const in130Days = new Date(Date.now() + 130 * 86400000);
    const purge = await lifecycle.runScheduled(in130Days);
    expect(purge.purgedWorkspaces).toBeGreaterThanOrEqual(1);
    expect(
      await readdir(path.join(storageDir, ws.owner.organizationId)),
    ).toHaveLength(0);
    const tomb = await db.sourceDocument.findUniqueOrThrow({
      where: { id: doc.id },
    });
    expect(tomb.deletedBy).toBe("system:retention");
    expect(
      await db.transaction.count({
        where: { organizationId: ws.owner.organizationId },
      }),
    ).toBe(2);
    expect(
      (await lifecycle.status(ws.owner.sessionId)).termination?.status,
    ).toBe("PURGED");
    const audit = await db.workspaceAudit.findFirst({
      where: { organizationId: ws.owner.organizationId, action: "DATA_PURGED" },
    });
    expect(audit).not.toBeNull();
  });

  it("keeps documents when no retention period is configured", async () => {
    const admin = await addUser(null, "OWNER", true);
    const ws = await workspaceWithOffer(admin);
    const lifecycle = lifecycleService(db, storage, {
      noticeDays: 30,
      retentionDays: null,
      suspendAfterOverdueDays: null,
    });
    const ended = await lifecycle.adminTerminate(admin.sessionId, {
      organizationId: ws.owner.organizationId,
      reason: "kontrak selesai",
    });
    expect(ended.status).toBe("TERMINATED");
    expect(ended.purgeAfter).toBeNull();
    const run = await lifecycle.runScheduled(
      new Date(Date.now() + 400 * 86400000),
    );
    expect(run.retentionConfigured).toBe(false);
    expect(
      (await lifecycle.status(ws.owner.sessionId)).termination?.status,
    ).toBe("TERMINATED");
    await expect(
      lifecycle.adminTerminate(ws.owner.sessionId, {
        organizationId: ws.owner.organizationId,
        reason: "x x x",
      }),
    ).rejects.toThrow("FORBIDDEN");
  });
});

describe("monthly invoices", () => {
  it("generates from metered usage, issues numbered invoices, records payment, and suspends overdue accounts", async () => {
    const admin = await addUser(null, "OWNER", true);
    const ws = await workspaceWithOffer(admin);
    await ws.create("INV-1");
    await ws.create("INV-2");
    const period = jakartaDate(new Date()).slice(0, 7);

    const noSeller = invoicingService(db, { ...seller, name: null });
    const invoicing = invoicingService(db, seller);
    await invoicing.adminCommand(admin.sessionId, {
      action: "generate",
      period,
    });
    const again = await invoicing.adminCommand(admin.sessionId, {
      action: "generate",
      period,
    });
    const list = await invoicing.adminList(admin.sessionId);
    const draft = list.invoices.find(
      (i) => i.organizationId === ws.owner.organizationId,
    )!;
    expect(draft.status).toBe("DRAFT");
    expect(draft.invoiceCount).toBe(2);
    expect(draft.subtotalIdr).toBe("5000.00");
    expect(draft.vatIdr).toBe("550.00");
    expect(draft.totalIdr).toBe("5550.00");
    expect((again as { created: number }).created).toBe(0);

    // Drafts are hidden from the customer; issuing needs the seller config.
    expect(
      (await invoicing.listForWorkspace(ws.owner.sessionId)).invoices,
    ).toHaveLength(0);
    await expect(
      noSeller.adminCommand(admin.sessionId, {
        action: "issue",
        invoiceId: draft.id,
      }),
    ).rejects.toThrow("SELLER_NOT_CONFIGURED");
    const issued = (await invoicing.adminCommand(admin.sessionId, {
      action: "issue",
      invoiceId: draft.id,
    })) as {
      number: string;
    };
    expect(issued.number).toMatch(
      new RegExp(`^${seller.prefix}/\\d{4}/\\d{2}/0001$`),
    );
    const customer = await invoicing.listForWorkspace(ws.preparer.sessionId);
    expect(customer.invoices[0].status).toBe("ISSUED");
    expect(
      (await invoicing.getInvoice(ws.preparer.sessionId, draft.id)).seller.name,
    ).toBe(seller.name);
    const outsider = await addUser(null, "OWNER");
    await expect(
      invoicing.getInvoice(outsider.sessionId, draft.id),
    ).rejects.toThrow("NOT_FOUND");

    // Overdue past the grace period suspends new records.
    await db.billingInvoice.update({
      where: { id: draft.id },
      data: { dueAt: new Date(Date.now() - 40 * 86400000) },
    });
    const { assertWorkspaceWritable } =
      await import("../../apps/web/src/server/lifecycle/state");
    await expect(
      db.$transaction((tx) =>
        assertWorkspaceWritable(tx, ws.owner.organizationId, new Date(), {
          noticeDays: 30,
          retentionDays: null,
          suspendAfterOverdueDays: 30,
        }),
      ),
    ).rejects.toThrow("BILLING_OVERDUE");

    await invoicing.adminCommand(admin.sessionId, {
      action: "mark_paid",
      invoiceId: draft.id,
      paidOn: jakartaDate(new Date()),
      method: "Transfer bank",
      reference: "TRF-001",
    });
    expect(
      (await invoicing.getInvoice(ws.owner.sessionId, draft.id)).status,
    ).toBe("PAID");
    await expect(
      invoicing.adminCommand(admin.sessionId, {
        action: "void",
        invoiceId: draft.id,
        reason: "salah",
      }),
    ).rejects.toThrow("INVALID_STATE");
    await expect(invoicing.adminList(ws.owner.sessionId)).rejects.toThrow(
      "FORBIDDEN",
    );
  });
});
