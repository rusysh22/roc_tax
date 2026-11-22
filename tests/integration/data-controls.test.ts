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
import { privacyService } from "../../apps/web/src/server/privacy/service";
import {
  perInvoiceSummary,
  salesService,
} from "../../apps/web/src/server/sales/service";
import type { Role } from "../../apps/web/src/server/workspaces/policy";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Isolated _test database required");
const db = new PrismaClient({
  adapter: new PrismaPg({ ...postgresOptions(url), max: 10 }),
});
const crypto = createTaxCrypto("synthetic-data-controls-secret-0123456789");
let storageDir = "";
let intake: ReturnType<typeof intakeService>;
const privacy = privacyService(db, crypto, {
  retentionDaysAfterTermination: 90,
  exportDaysAfterTermination: 30,
  dataLocation: "Synthetic region",
  subprocessors: [
    { name: "Synthetic Host", purpose: "Hosting", location: "ID" },
  ],
});
const sales = salesService(db, crypto, { pepper: "synthetic-pepper" });

const users: string[] = [];
const orgs: string[] = [];
const leadEmails: string[] = [];

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
      data: { name: "Synthetic Data Org", legalName: "PT Synthetic Data" },
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

async function workspace() {
  const owner = await addUser(null, "OWNER");
  const preparer = await addUser(owner.organizationId, "PREPARER");
  const company = await intake.mutateCompany(owner.sessionId, {
    action: "create",
    company: {
      name: "PT Data Uji",
      legalName: "PT Data Uji",
      npwp: "0000000000000077",
    },
  });
  const counterparty = (await intake.mutateCounterparty(owner.sessionId, {
    action: "create",
    counterparty: {
      kind: "VENDOR",
      name: "CV Data Rekan",
      identityType: "NPWP",
      identity: "0000000000000088",
      countryCode: "ID",
    },
  })) as { id: string };
  return { owner, preparer, companyId: company.id, cpId: counterparty.id };
}

let seq = 5000;
function draft(
  ctx: { companyId: string; cpId: string },
  invoiceNumber: string,
) {
  return {
    action: "create",
    idempotencyKey: randomUUID(),
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
      lines: [
        { description: "Jasa uji", quantity: "1", unitPrice: `${seq++}.00` },
      ],
    },
  };
}

async function setOffer(
  superadmin: { sessionId: string },
  organizationId: string,
  overrides: Partial<{
    active: boolean;
    monthlyInvoiceCap: number | null;
    pricingModel: string;
  }> = {},
) {
  await sales.adminCommand(superadmin.sessionId, {
    action: "offer_upsert",
    organizationId,
    pricingModel: overrides.pricingModel ?? "PER_INVOICE",
    pricePerInvoiceIdr: "1500.00",
    minimumMonthlyIdr: "5000.00",
    monthlyInvoiceCap: overrides.monthlyInvoiceCap ?? null,
    offerReference: "SYN/OFFER/001",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    active: overrides.active ?? true,
    notes: "",
  });
}

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(tmpdir(), "serentax-data-controls-"));
  intake = intakeService(db, crypto, localDocumentStorage(storageDir));
});

afterAll(async () => {
  await db.entitledUsage.deleteMany({
    where: { organizationId: { in: orgs } },
  });
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.salesLead.deleteMany({ where: { email: { in: leadEmails } } });
  await rm(storageDir, { recursive: true, force: true });
  await db.$disconnect();
});

describe("per-invoice offers (sales-led pricing)", () => {
  it("meters transactions without a trial or license and computes charges", async () => {
    const ctx = await workspace();
    const admin = await addUser(null, "OWNER", true);
    await expect(
      intake.createTransaction(ctx.preparer.sessionId, draft(ctx, "PI-0")),
    ).rejects.toThrow("NOT_ACTIVATED");

    await setOffer(admin, ctx.owner.organizationId);
    await intake.createTransaction(ctx.preparer.sessionId, draft(ctx, "PI-1"));
    await intake.createTransaction(ctx.preparer.sessionId, draft(ctx, "PI-2"));
    const receipts = await db.entitledUsage.findMany({
      where: { organizationId: ctx.owner.organizationId },
    });
    expect(receipts.map((r) => r.planCode)).toEqual([
      "PER_INVOICE",
      "PER_INVOICE",
    ]);

    const summary = await db.$transaction((tx) =>
      perInvoiceSummary(tx, ctx.owner.organizationId, new Date()),
    );
    expect(summary?.active).toBe(true);
    expect(summary?.months[0].invoices).toBe(2);
    // 2 × 1,500 < 5,000 minimum → the minimum applies.
    expect(summary?.months[0].chargeIdr).toBe("5000.00");
    expect(summary?.months).toHaveLength(6);

    // A monthly cap stops new transactions once reached.
    await setOffer(admin, ctx.owner.organizationId, { monthlyInvoiceCap: 2 });
    await expect(
      intake.createTransaction(ctx.preparer.sessionId, draft(ctx, "PI-3")),
    ).rejects.toThrow("MONTHLY_LIMIT");

    // Inactive offer → back to trial rules.
    await setOffer(admin, ctx.owner.organizationId, { active: false });
    await expect(
      intake.createTransaction(ctx.preparer.sessionId, draft(ctx, "PI-4")),
    ).rejects.toThrow("NOT_ACTIVATED");
  });

  it("only superadmins can manage offers", async () => {
    const ctx = await workspace();
    await expect(setOffer(ctx.owner, ctx.owner.organizationId)).rejects.toThrow(
      "FORBIDDEN",
    );
  });
});

describe("customer document deletion", () => {
  it("removes the file and OCR candidates, keeps a tombstone, and allows re-upload", async () => {
    const ctx = await workspace();
    const admin = await addUser(null, "OWNER", true);
    await setOffer(admin, ctx.owner.organizationId);
    const created = (await intake.createTransaction(
      ctx.preparer.sessionId,
      draft(ctx, "DOC-1"),
    )) as {
      transactionId: string;
    };
    const file = {
      bytes: Buffer.from("%PDF-1.4\nINVOICE:DEL-1\n", "utf-8"),
      declaredType: "application/pdf",
      fileName: "faktur.pdf",
    };
    const doc = await intake.attachDocument(
      ctx.preparer.sessionId,
      created.transactionId,
      file,
    );
    const orgDir = path.join(storageDir, ctx.owner.organizationId);
    expect(await readdir(orgDir)).toHaveLength(1);

    await intake.deleteDocument(
      ctx.preparer.sessionId,
      created.transactionId,
      doc.id,
    );
    expect(await readdir(orgDir)).toHaveLength(0);
    await expect(
      intake.readDocument(
        ctx.preparer.sessionId,
        created.transactionId,
        doc.id,
      ),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      intake.deleteDocument(
        ctx.preparer.sessionId,
        created.transactionId,
        doc.id,
      ),
    ).rejects.toThrow("NOT_FOUND");

    const tombstone = await db.sourceDocument.findUniqueOrThrow({
      where: { id: doc.id },
    });
    expect(tombstone.deletedAt).not.toBeNull();
    expect(tombstone.sha256).toBe(doc.sha256);
    const event = await db.transactionEvent.findFirst({
      where: {
        transactionId: created.transactionId,
        action: "DOCUMENT_DELETED",
      },
    });
    expect(event).not.toBeNull();

    // The same file can be attached again after deletion.
    const again = await intake.attachDocument(
      ctx.preparer.sessionId,
      created.transactionId,
      file,
    );
    expect(again.id).not.toBe(doc.id);
    const detail = (await intake.getTransaction(
      ctx.preparer.sessionId,
      created.transactionId,
    )) as {
      transaction: { documents: { id: string; deletedAt: string | null }[] };
    };
    expect(
      detail.transaction.documents.map((d) => Boolean(d.deletedAt)),
    ).toEqual([true, false]);
  });
});

describe("workspace data export and privacy overview", () => {
  it("exports decrypted data for owners, audits it, and refuses other roles", async () => {
    const ctx = await workspace();
    await expect(privacy.exportData(ctx.preparer.sessionId)).rejects.toThrow(
      "FORBIDDEN",
    );
    const exported = await privacy.exportData(ctx.owner.sessionId);
    expect(exported.format).toBe("serentax-workspace-export");
    expect(exported.companies[0].npwp).toBe("0000000000000077");
    expect(exported.counterparties[0].identity).toBe("0000000000000088");
    expect(exported.members).toHaveLength(2);
    const audit = await db.workspaceAudit.findFirst({
      where: {
        organizationId: ctx.owner.organizationId,
        action: "DATA_EXPORTED",
      },
    });
    expect(audit).not.toBeNull();

    const overview = await privacy.overview(ctx.preparer.sessionId);
    expect(overview.canExport).toBe(false);
    expect(overview.retention.daysAfterTermination).toBe(90);
    expect(overview.subprocessors[0]).toMatchObject({
      name: "Synthetic Host",
      source: "PLATFORM",
    });
  });
});

describe("sales-led registration", () => {
  it("stores valid leads, ignores honeypot bots, rate-limits, and lists them for superadmins", async () => {
    const requester = `synthetic-${randomUUID()}`;
    const email = `${randomUUID()}@example.test`;
    leadEmails.push(email);
    const lead = {
      companyName: "PT Prospek Sintetis",
      picName: "Budi Sintetis",
      email,
      phone: "+62 812 0000 0000",
      npwp: "0000000000000066",
      estimatedMonthlyInvoices: 120,
      message: "",
      locale: "id",
    };
    await sales.submitLead(lead, requester);
    const stored = await db.salesLead.findFirstOrThrow({ where: { email } });
    expect(stored.npwpHint).toBe("0066");
    expect(stored.npwpCipher).not.toContain("0000000000000066");

    await sales
      .submitLead({ ...lead, website: "spam" }, requester)
      .catch(() => undefined);
    await expect(
      sales.submitLead({ ...lead, phone: "abc" }, requester),
    ).rejects.toThrow("INVALID_INPUT");
    for (let i = 0; i < 4; i += 1) await sales.submitLead(lead, requester);
    await expect(sales.submitLead(lead, requester)).rejects.toThrow(
      "RATE_LIMITED",
    );
    expect(await db.salesLead.count({ where: { email } })).toBe(5);

    const admin = await addUser(null, "OWNER", true);
    const overview = await sales.adminOverview(admin.sessionId);
    expect(overview.leads.some((l) => l.email === email)).toBe(true);
    const member = await addUser(null, "OWNER");
    await expect(sales.adminOverview(member.sessionId)).rejects.toThrow(
      "FORBIDDEN",
    );
  });
});
