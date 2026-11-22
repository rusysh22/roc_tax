/**
 * Local development seed: master data + simulated transactions for SerenTax.
 *
 * Every record is created through the real application services (encryption,
 * audit, quota, review workflow and XML export rules all apply). All names,
 * tax IDs and amounts are SYNTHETIC. The demo tax rules are marked
 * SME_APPROVED only so the full flow can be exercised locally; they are NOT a
 * Tax SME sign-off and must never be copied to a shared or production database.
 *
 * Usage:  npm run db:seed:dev            (refuses if demo data already exists)
 *         npm run db:seed:dev -- --reset (deletes demo data, then reseeds)
 * Guard:  DATABASE_URL must point at a database whose name ends in "_dev".
 */
import "dotenv/config";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../apps/web/src/generated/prisma/client";
import { postgresOptions } from "../apps/web/src/server/postgres";
import { getTaxCrypto } from "../apps/web/src/server/intake/crypto";
import { intakeService } from "../apps/web/src/server/intake/service";
import { importBatchService } from "../apps/web/src/server/intake/imports";
import { localDocumentStorage } from "../apps/web/src/server/intake/storage";
import { taxService } from "../apps/web/src/server/tax/service";
import { exportService } from "../apps/web/src/server/export/service";
import { billingService } from "../apps/web/src/server/billing/service";

const DEMO_PASSWORD = "DevOnly-Passw0rd!2026";
const ORG_NAME = "PT Demo Serentak Nusantara";
const DEMO_LABEL = "DEMO LOKAL — data sintetis, bukan persetujuan Tax SME";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const dbName = new URL(url).pathname.replace(/^\//, "");
if (!dbName.endsWith("_dev") || process.env.NODE_ENV === "production")
  throw new Error(
    `Refusing to seed "${dbName}": the dev seed only runs against a *_dev database.`,
  );

const db = new PrismaClient({ adapter: new PrismaPg(postgresOptions(url)) });
const crypto = getTaxCrypto();
// The Next server runs from apps/web, so documents and XML exports live there.
const storage = localDocumentStorage(
  process.env.DOCUMENT_STORAGE_DIR ||
    path.resolve(process.cwd(), "apps/web/.local-storage"),
);
const intake = intakeService(db, crypto, storage);
const imports = importBatchService(db, crypto);
const tax = taxService(db);
const exporter = exportService(db, crypto, storage);
const billing = billingService(db, crypto);

const seedSessions: string[] = [];

const users = {
  owner: {
    email: "dev.tester@example.test",
    name: "Dev Tester (Pemilik)",
    role: "OWNER" as const,
    superadmin: true,
  },
  preparer: {
    email: "penyusun@example.test",
    name: "Putri Penyusun",
    role: "PREPARER" as const,
    superadmin: false,
  },
  reviewer: {
    email: "peninjau@example.test",
    name: "Rudi Peninjau",
    role: "REVIEWER" as const,
    superadmin: false,
  },
  approver: {
    email: "penyetuju@example.test",
    name: "Ani Penyetuju",
    role: "APPROVER" as const,
    superadmin: false,
  },
};
type UserKey = keyof typeof users;

const demoRuleCodes = [
  "DEMO-PPH23-JASA",
  "DEMO-PPH23-SEWA",
  "DEMO-PPH42-SEWA-TB",
  "DEMO-PPN-KELUARAN",
  "DEMO-PPH23-DRAFT",
];

async function reset() {
  const org = await db.organization.findFirst({ where: { name: ORG_NAME } });
  if (org) {
    const orgId = org.id;
    // Immutable rows (BEFORE UPDATE triggers) may still be deleted.
    await db.xmlExportOutcome.deleteMany({ where: { organizationId: orgId } });
    await db.xmlExportItem.deleteMany({ where: { organizationId: orgId } });
    await db.xmlExportBatch.deleteMany({ where: { organizationId: orgId } });
    await db.supportAccessAudit.deleteMany({
      where: { organizationId: orgId },
    });
    await db.entitledUsage.deleteMany({ where: { organizationId: orgId } });
    await db.trialUsage.deleteMany({ where: { organizationId: orgId } });
    await db.organization.delete({ where: { id: orgId } });
  }
  await db.taxRule.deleteMany({ where: { code: { in: demoRuleCodes } } });
  const demoEmails = Object.values(users)
    .map((u) => u.email)
    .filter((e) => e !== users.owner.email);
  const demoUsers = await db.user.findMany({
    where: { email: { in: demoEmails } },
  });
  const ids = demoUsers.map((u) => u.id);
  await db.trialUsage.deleteMany({ where: { userId: { in: ids } } });
  await db.trialAccount.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  console.log("Demo data removed.");
}

async function ensureUser(key: UserKey) {
  const spec = users[key];
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  let user = await db.user.findUnique({ where: { email: spec.email } });
  if (!user) {
    user = await db.user.create({
      data: {
        id: randomUUID(),
        name: spec.name,
        email: spec.email,
        emailVerified: true,
      },
    });
  }
  user = await db.user.update({
    where: { id: user.id },
    data: {
      name: spec.name,
      emailVerified: true,
      platformRole: spec.superadmin ? "SUPERADMIN" : "NONE",
    },
  });
  const account = await db.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
  });
  if (account)
    await db.account.update({
      where: { id: account.id },
      data: { password: passwordHash },
    });
  else
    await db.account.create({
      data: {
        id: randomUUID(),
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    });
  return user;
}

async function sessionFor(userId: string, organizationId: string | null) {
  const id = randomUUID();
  await db.session.create({
    data: {
      id,
      token: `seed-${randomUUID()}`,
      userId,
      activeOrganizationId: organizationId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      userAgent: "serentax-dev-seed",
    },
  });
  seedSessions.push(id);
  return id;
}

async function version(transactionId: string) {
  return (
    await db.transaction.findUniqueOrThrow({ where: { id: transactionId } })
  ).version;
}

function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
    new Date(),
  );
}
function shiftDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  if (process.argv.includes("--reset")) await reset();
  if (await db.organization.findFirst({ where: { name: ORG_NAME } })) {
    console.log(
      `Demo workspace "${ORG_NAME}" already exists. Run with --reset to recreate it.`,
    );
    return;
  }

  // ---------------------------------------------------------------- users ---
  const u = {
    owner: await ensureUser("owner"),
    preparer: await ensureUser("preparer"),
    reviewer: await ensureUser("reviewer"),
    approver: await ensureUser("approver"),
  };

  const org = await db.organization.create({
    data: {
      name: ORG_NAME,
      legalName: `${ORG_NAME} (Sintetis)`,
      memberships: {
        create: (Object.keys(users) as UserKey[]).map((key) => ({
          userId: u[key].id,
          role: users[key].role,
        })),
      },
    },
  });
  await db.workspaceAudit.create({
    data: {
      organizationId: org.id,
      actorId: u.owner.id,
      action: "WORKSPACE_CREATED",
    },
  });
  const s = {
    owner: await sessionFor(u.owner.id, org.id),
    preparer: await sessionFor(u.preparer.id, org.id),
    reviewer: await sessionFor(u.reviewer.id, org.id),
    approver: await sessionFor(u.approver.id, org.id),
  };
  // Point every demo user's future browser sessions at the demo workspace.
  await db.session.updateMany({
    where: {
      userId: { in: Object.values(u).map((x) => x.id) },
      activeOrganizationId: null,
    },
    data: { activeOrganizationId: org.id },
  });

  // ------------------------------------------------- platform (superadmin) ---
  await billing.mutateAdminBilling(s.owner, {
    action: "configure",
    adapterMode: "SYNTHETIC_TEST",
    saasLicensingApproved: false,
    compatibilityNote:
      "Local development only: SYNTHETIC_TEST billing double. Not a Berlanggan confirmation.",
  });

  const today = jakartaToday();
  const period = today.slice(0, 7);
  const prevMonthDate = shiftDays(`${period}-01`, -10);
  const prevPeriod = prevMonthDate.slice(0, 7);
  const ruleFrom = `${String(Number(today.slice(0, 4)) - 1)}-01-01`;

  const ruleBase = {
    action: "create" as const,
    version: 1,
    jurisdiction: "ID" as const,
    effectiveFrom: ruleFrom,
    roundingMode: "HALF_UP" as const,
    requireCounterpartyIdentity: true,
    requirePayrollEvidence: false,
    requireTreatyEvidence: false,
    sourceCitation: DEMO_LABEL,
  };
  for (const rule of [
    {
      code: "DEMO-PPH23-JASA",
      taxFamily: "PPH_UNIFIKASI_BPPU",
      documentType: "SUPPLIER_INVOICE",
      objectCode: "DEMO-23-JASA",
      name: "DEMO PPh 23 — jasa (2%)",
      rateNumerator: 2,
      rateDenominator: 100,
      catalogStatus: "SME_APPROVED",
      smeReviewedBy: "DEMO LOKAL (bukan Tax SME)",
    },
    {
      code: "DEMO-PPH23-SEWA",
      taxFamily: "PPH_UNIFIKASI_BPPU",
      documentType: "SUPPLIER_INVOICE",
      objectCode: "DEMO-23-SEWA",
      name: "DEMO PPh 23 — sewa harta selain tanah/bangunan (2%)",
      rateNumerator: 2,
      rateDenominator: 100,
      catalogStatus: "SME_APPROVED",
      smeReviewedBy: "DEMO LOKAL (bukan Tax SME)",
    },
    {
      code: "DEMO-PPH42-SEWA-TB",
      taxFamily: "PPH_UNIFIKASI_BPPU",
      documentType: "SUPPLIER_INVOICE",
      objectCode: "DEMO-42-SEWA-TB",
      name: "DEMO PPh 4(2) — sewa tanah/bangunan (10%)",
      rateNumerator: 10,
      rateDenominator: 100,
      catalogStatus: "SME_APPROVED",
      smeReviewedBy: "DEMO LOKAL (bukan Tax SME)",
    },
    {
      code: "DEMO-PPN-KELUARAN",
      taxFamily: "PPN_FAKTUR_KELUARAN",
      documentType: "SALES_INVOICE",
      objectCode: "DEMO-PPN",
      name: "DEMO PPN keluaran (pratinjau non-produksi)",
      rateNumerator: 11,
      rateDenominator: 100,
      catalogStatus: "NON_PRODUCTION_TEST",
    },
    {
      code: "DEMO-PPH23-DRAFT",
      taxFamily: "PPH_UNIFIKASI_BPPU",
      documentType: "SUPPLIER_INVOICE",
      objectCode: "DEMO-23-ROYALTI",
      name: "DEMO PPh 23 — royalti (draf, belum ditinjau)",
      rateNumerator: 15,
      rateDenominator: 100,
      catalogStatus: "DRAFT",
    },
  ])
    await tax.mutateRule(s.owner, { ...ruleBase, ...rule });

  // --------------------------------------------------- workspace / billing ---
  await billing.executeOrgBillingCommand(s.owner, {
    action: "activate",
    licenseKey: "SYNTH-ACTIVE-DEMO-0001",
  });

  // ---------------------------------------------------------- master data ---
  const hq = await intake.mutateCompany(s.owner, {
    action: "create",
    company: {
      name: "Demo Serentak — Kantor Pusat",
      legalName: ORG_NAME,
      npwp: "9990000000000001",
      nitku: "9990000000000001000000",
      address: "Jl. Contoh Sintetis No. 1, Jakarta (alamat fiktif)",
    },
  });
  const branch = await intake.mutateCompany(s.owner, {
    action: "create",
    company: {
      name: "Demo Serentak — Cabang Bandung",
      legalName: "CV Demo Serentak Bandung (Sintetis)",
      npwp: "9990000000000002",
      nitku: "9990000000000002000000",
      address: "Jl. Fiktif No. 2, Bandung (alamat fiktif)",
    },
  });

  const cp = async (counterparty: Record<string, unknown>) =>
    (await intake.mutateCounterparty(s.preparer, {
      action: "create",
      counterparty: { countryCode: "ID", ...counterparty },
    })) as { id: string };
  const vendors = {
    konsultan: await cp({
      kind: "VENDOR",
      name: "PT Konsultan Contoh Abadi",
      identityType: "NPWP",
      identity: "9991000000000001",
    }),
    teknologi: await cp({
      kind: "VENDOR",
      name: "PT Solusi Teknologi Fiktif",
      identityType: "NPWP",
      identity: "9991000000000002",
    }),
    sewaAlat: await cp({
      kind: "VENDOR",
      name: "CV Sewa Alat Sintetis",
      identityType: "NPWP",
      identity: "9991000000000003",
    }),
    gedung: await cp({
      kind: "VENDOR",
      name: "PT Properti Gedung Contoh",
      identityType: "NPWP",
      identity: "9991000000000004",
    }),
    perorangan: await cp({
      kind: "VENDOR",
      name: "Budi Santoso (Jasa Desain, fiktif)",
      identityType: "NIK",
      identity: "9992000000000001",
    }),
    tanpaId: await cp({
      kind: "VENDOR",
      name: "Toko Tanpa NPWP Contoh",
      identityType: "NONE",
    }),
    luarNegeri: await cp({
      kind: "VENDOR",
      name: "Example Software Pte Ltd (fictitious)",
      identityType: "FOREIGN_TIN",
      identity: "SG-DEMO-0001",
      countryCode: "SG",
    }),
  };
  const customer = await cp({
    kind: "CUSTOMER",
    name: "PT Pelanggan Utama Fiktif",
    identityType: "NPWP",
    identity: "9993000000000001",
  });

  // --------------------------------------------------------- transactions ---
  async function draft(
    invoiceNumber: string,
    opts: {
      companyId?: string;
      counterpartyId: string;
      date: string;
      amount: string;
      description: string;
      family?: string;
      documentType?: string;
    },
  ) {
    const created = (await intake.createTransaction(s.preparer, {
      action: "create",
      idempotencyKey: randomUUID(),
      acknowledgeDuplicates: false,
      draft: {
        companyId: opts.companyId ?? hq.id,
        counterpartyId: opts.counterpartyId,
        taxFamily: opts.family ?? "PPH_UNIFIKASI_BPPU",
        documentType: opts.documentType ?? "SUPPLIER_INVOICE",
        invoiceNumber,
        documentDate: opts.date,
        taxPeriod: opts.date.slice(0, 7),
        currency: "IDR",
        description: opts.description,
        lines: [
          {
            description: opts.description,
            quantity: "1",
            unitPrice: opts.amount,
          },
        ],
      },
    })) as { transactionId: string };
    return created.transactionId;
  }
  const evaluate = (id: string, objectCode: string, by = s.preparer) =>
    tax.executeReviewCommand(by, id, { action: "evaluate", objectCode });
  const submit = async (id: string) =>
    tax.executeReviewCommand(s.preparer, id, {
      action: "submit",
      version: await version(id),
    });
  const approve = async (id: string) =>
    tax.executeReviewCommand(s.approver, id, {
      action: "approve",
      version: await version(id),
    });

  const inPeriod = (offset: number) => {
    const candidate = shiftDays(today, -offset);
    return candidate.slice(0, 7) === period ? candidate : `${period}-01`;
  };

  // Approved + exported (current period).
  const exported = [
    await draft("INV/DEMO/2026/001", {
      counterpartyId: vendors.konsultan.id,
      date: inPeriod(9),
      amount: "25000000.00",
      description: "Jasa konsultasi pajak (sintetis)",
    }),
    await draft("INV/DEMO/2026/002", {
      counterpartyId: vendors.teknologi.id,
      date: inPeriod(7),
      amount: "15750000.00",
      description: "Jasa implementasi sistem (sintetis)",
    }),
    await draft("INV/DEMO/2026/003", {
      counterpartyId: vendors.gedung.id,
      date: inPeriod(6),
      amount: "40000000.00",
      description: "Sewa ruang kantor (sintetis)",
    }),
  ];
  const exportedCodes = ["DEMO-23-JASA", "DEMO-23-JASA", "DEMO-42-SEWA-TB"];
  for (const [i, id] of exported.entries()) {
    await evaluate(id, exportedCodes[i]);
    await submit(id);
    await approve(id);
  }

  // Approved, ready to export.
  const approvedReady = await draft("INV/DEMO/2026/004", {
    counterpartyId: vendors.sewaAlat.id,
    date: inPeriod(5),
    amount: "8400000.00",
    description: "Sewa alat berat (sintetis)",
  });
  await evaluate(approvedReady, "DEMO-23-SEWA");
  await submit(approvedReady);
  await approve(approvedReady);

  // Submitted, waiting for the approver.
  const waiting = await draft("INV/DEMO/2026/005", {
    counterpartyId: vendors.perorangan.id,
    date: inPeriod(4),
    amount: "6000000.00",
    description: "Jasa desain grafis (sintetis)",
  });
  await evaluate(waiting, "DEMO-23-JASA");
  await submit(waiting);

  // Changes requested by the reviewer.
  const changes = await draft("INV/DEMO/2026/006", {
    counterpartyId: vendors.teknologi.id,
    date: inPeriod(3),
    amount: "12500000.00",
    description: "Lisensi & dukungan teknis (sintetis)",
  });
  await evaluate(changes, "DEMO-23-JASA");
  await submit(changes);
  await tax.executeReviewCommand(s.reviewer, changes, {
    action: "request_changes",
    version: await version(changes),
    reason:
      "Mohon lampirkan kontrak dan pastikan kode objek pajak sesuai (contoh simulasi).",
  });

  // Validated, ready to submit.
  const validated = await draft("INV/DEMO/2026/007", {
    counterpartyId: vendors.konsultan.id,
    date: inPeriod(2),
    amount: "9900000.00",
    description: "Jasa audit internal (sintetis)",
  });
  await evaluate(validated, "DEMO-23-JASA", s.reviewer);

  // Evaluated with a blocker: counterparty has no tax identity.
  const blocked = await draft("INV/DEMO/2026/008", {
    counterpartyId: vendors.tanpaId.id,
    date: inPeriod(2),
    amount: "3250000.00",
    description: "Jasa perawatan AC (sintetis)",
  });
  await evaluate(blocked, "DEMO-23-JASA");

  // Plain drafts.
  await draft("INV/DEMO/2026/009", {
    counterpartyId: vendors.luarNegeri.id,
    date: inPeriod(1),
    amount: "18000000.00",
    description: "Langganan perangkat lunak luar negeri (sintetis)",
    family: "UNCLASSIFIED",
  });
  const salesDraft = await draft("FK/DEMO/2026/001", {
    counterpartyId: customer.id,
    date: inPeriod(1),
    amount: "55000000.00",
    description: "Penjualan jasa implementasi (sintetis)",
    family: "PPN_FAKTUR_KELUARAN",
    documentType: "SALES_INVOICE",
  });
  // Non-production rule: evaluation is a preview and cannot be submitted.
  await evaluate(salesDraft, "DEMO-PPN");
  await draft("INV/DEMO/2026/010", {
    companyId: branch.id,
    counterpartyId: vendors.sewaAlat.id,
    date: inPeriod(0),
    amount: "4750000.00",
    description: "Sewa kendaraan operasional cabang (sintetis)",
  });

  // Voided draft.
  const voided = await draft("INV/DEMO/2026/011", {
    counterpartyId: vendors.konsultan.id,
    date: inPeriod(8),
    amount: "1000000.00",
    description: "Invoice salah input (sintetis)",
  });
  await intake.mutateTransaction(s.preparer, voided, {
    action: "void",
    version: await version(voided),
    reason: "Duplikat input — simulasi pembatalan",
  });

  // Previous period: approved & exported, Coretax accepted.
  const prev = await draft("INV/DEMO/2026/090", {
    counterpartyId: vendors.konsultan.id,
    date: prevMonthDate,
    amount: "20000000.00",
    description: "Jasa konsultasi bulan lalu (sintetis)",
  });
  await evaluate(prev, "DEMO-23-JASA");
  await submit(prev);
  await approve(prev);

  await intake.mutateTransaction(s.reviewer, changes, {
    action: "comment",
    body: "Kontrak belum terlampir. Simulasi komentar peninjau.",
  });

  // ------------------------------------------------- spreadsheet import ---
  const csv = [
    "invoice_number,document_date,tax_period,document_type,tax_family,counterparty_name,counterparty_tax_id,description,line_description,quantity,unit_price,currency",
    `IMP/DEMO/001,${inPeriod(3)},${period},SUPPLIER_INVOICE,PPH_UNIFIKASI_BPPU,PT Konsultan Contoh Abadi,,Impor massal,Jasa pelatihan (sintetis),1,7500000.00,IDR`,
    `IMP/DEMO/002,${inPeriod(3)},${period},SUPPLIER_INVOICE,PPH_UNIFIKASI_BPPU,CV Sewa Alat Sintetis,,Impor massal,Sewa genset (sintetis),2,1250000.00,IDR`,
    `IMP/DEMO/003,${inPeriod(2)},${period},SUPPLIER_INVOICE,PPH_UNIFIKASI_BPPU,PT Solusi Teknologi Fiktif,,Impor massal,Pemeliharaan server (sintetis),1,3300000.00,IDR`,
  ].join("\n");
  const imported = await imports.commit(s.preparer, {
    idempotencyKey: randomUUID(),
    companyId: hq.id,
    fileName: "demo-impor-massal.csv",
    bytes: new TextEncoder().encode(csv),
    acknowledgeDuplicates: false,
  });

  // ------------------------------------------------------------- exports ---
  const exportCurrent = await exporter.generateExport(s.preparer, {
    companyId: hq.id,
    taxFamily: "PPH_UNIFIKASI_BPPU",
    taxPeriod: period,
    transactionIds: exported,
    idempotencyKey: randomUUID(),
  });
  await exporter.recordOutcome(s.preparer, exportCurrent.batch.id, {
    outcome: "CORETAX_SUBMITTED",
    coretaxReference: "DEMO-UPLOAD-0001",
    notes: "Simulasi: XML diunggah manual ke Coretax.",
  });

  const exportPrev = await exporter.generateExport(s.preparer, {
    companyId: hq.id,
    taxFamily: "PPH_UNIFIKASI_BPPU",
    taxPeriod: prevPeriod,
    transactionIds: [prev],
    idempotencyKey: randomUUID(),
  });
  await exporter.recordOutcome(s.preparer, exportPrev.batch.id, {
    outcome: "CORETAX_SUBMITTED",
    coretaxReference: "DEMO-UPLOAD-0000",
  });
  await exporter.recordOutcome(s.approver, exportPrev.batch.id, {
    outcome: "CORETAX_ACCEPTED",
    coretaxReference: "DEMO-BPPU-ACCEPTED-0000",
    notes: "Simulasi: diterima di portal Coretax.",
  });

  const counts = await db.transaction.groupBy({
    by: ["status"],
    where: { organizationId: org.id },
    _count: true,
  });
  console.log(`\nSeeded demo workspace "${ORG_NAME}" (${org.id}).`);
  console.log(
    `Transactions by status: ${counts.map((c) => `${c.status}=${c._count}`).join(", ")}`,
  );
  console.log(
    `Import batch: ${imported.createdCount} rows. Exports: v${exportCurrent.batch.exportVersion} (${period}), v${exportPrev.batch.exportVersion} (${prevPeriod}).`,
  );
  console.log(`\nLogin (password for all: ${DEMO_PASSWORD}):`);
  for (const key of Object.keys(users) as UserKey[])
    console.log(
      `  ${users[key].role.padEnd(9)} ${users[key].email}${users[key].superadmin ? "  (+ SUPERADMIN)" : ""}`,
    );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.session.deleteMany({ where: { id: { in: seedSessions } } });
    await db.$disconnect();
  });
