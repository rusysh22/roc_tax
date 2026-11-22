import { z } from "zod";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import {
  AMOUNT_SCALE,
  formatFixed,
  parseFixed,
} from "../../lib/intake/decimal";
import { isSafeHttpsEndpointUrl } from "../../lib/intake/ocr";
import { perInvoiceCharge, recentJakartaMonths } from "../sales/service";
import { jakartaDate } from "../trial/state";
import { PER_INVOICE_PLAN_CODE } from "../trial/service";
import { DAY_MS } from "../lifecycle/state";
import { AccessError } from "../workspaces/policy";
import { requireActor, requireMembership } from "../workspaces/service";

type Tx = Prisma.TransactionClient;

export class InvoiceError extends Error {
  constructor(
    public code:
      | "NOT_FOUND"
      | "SELLER_NOT_CONFIGURED"
      | "INVALID_STATE"
      | "INVALID_PAYMENT_LINK",
  ) {
    super(code);
  }
}

/** Issuer details printed on invoices (server configuration, never hard-coded). */
export type SellerConfig = {
  name: string | null;
  npwp: string | null;
  address: string | null;
  email: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
  prefix: string;
};

export function readSellerConfig(
  env: NodeJS.ProcessEnv = process.env,
): SellerConfig {
  const v = (key: string) => env[key]?.trim().slice(0, 300) || null;
  return {
    name: v("BILLING_SELLER_NAME"),
    npwp: v("BILLING_SELLER_NPWP"),
    address: v("BILLING_SELLER_ADDRESS"),
    email: v("BILLING_SELLER_EMAIL"),
    bankName: v("BILLING_BANK_NAME"),
    bankAccountNo: v("BILLING_BANK_ACCOUNT_NO"),
    bankAccountName: v("BILLING_BANK_ACCOUNT_NAME"),
    prefix:
      (v("BILLING_INVOICE_PREFIX") ?? "INV/SRX")
        .replace(/[^A-Za-z0-9/_-]/g, "")
        .slice(0, 30) || "INV/SRX",
  };
}

export function sellerConfigured(s: SellerConfig) {
  return Boolean(
    s.name && s.address && s.bankName && s.bankAccountNo && s.bankAccountName,
  );
}

/** VAT = round-half-up(subtotal × rate%), decimal-safe. */
export function vatAmount(subtotal: string, ratePercent: string) {
  const sub = parseFixed(subtotal, AMOUNT_SCALE);
  const rate = parseFixed(ratePercent, 2);
  return formatFixed((sub * rate + 5000n) / 10000n, AMOUNT_SCALE);
}

export function addAmounts(a: string, b: string) {
  return formatFixed(
    parseFixed(a, AMOUNT_SCALE) + parseFixed(b, AMOUNT_SCALE),
    AMOUNT_SCALE,
  );
}

const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const invoiceAdminCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), period: periodSchema }).strict(),
  z
    .object({
      action: z.literal("issue"),
      invoiceId: z.string().min(1).max(100),
      paymentLink: z
        .string()
        .trim()
        .max(500)
        .optional()
        .transform((v) => v || undefined),
    })
    .strict(),
  z
    .object({
      action: z.literal("mark_paid"),
      invoiceId: z.string().min(1).max(100),
      paidOn: z.iso.date(),
      method: z.string().trim().min(2).max(60),
      reference: z.string().trim().min(2).max(120),
    })
    .strict(),
  z
    .object({
      action: z.literal("void"),
      invoiceId: z.string().min(1).max(100),
      reason: z.string().trim().min(3).max(500),
    })
    .strict(),
]);

type InvoiceRow = Prisma.BillingInvoiceGetPayload<{
  include: { organization: { select: { name: true } } };
}>;

function view(row: InvoiceRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    workspace: row.organization.name,
    number: row.status === "DRAFT" ? null : row.number,
    period: row.period,
    status: row.status,
    invoiceCount: row.invoiceCount,
    pricePerInvoiceIdr: row.pricePerInvoiceIdr.toFixed(2),
    minimumMonthlyIdr: row.minimumMonthlyIdr.toFixed(2),
    subtotalIdr: row.subtotalIdr.toFixed(2),
    vatRatePercent: row.vatRatePercent.toFixed(2),
    vatIdr: row.vatIdr.toFixed(2),
    totalIdr: row.totalIdr.toFixed(2),
    offerReference: row.offerReference,
    seller: row.sellerSnapshot as Record<string, string | null>,
    buyer: row.buyerSnapshot as Record<string, string | null>,
    paymentLink: row.paymentLink,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    dueAt: row.dueAt?.toISOString() ?? null,
    paidAt: row.paidAt?.toISOString() ?? null,
    paymentMethod: row.paymentMethod,
    paymentReference: row.paymentReference,
    voidReason: row.voidReason,
  };
}
export type InvoiceView = ReturnType<typeof view>;

async function databaseNow(tx: Tx) {
  return (
    await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
  )[0].now;
}

function monthBounds(period: string) {
  const start = new Date(`${period}-01T00:00:00+07:00`);
  const [y, m] = period.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  const nextPeriod = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start, end: new Date(`${nextPeriod}-01T00:00:00+07:00`) };
}

/**
 * Monthly customer invoices for per-invoice offers. Superadmins generate
 * drafts from metered usage, issue them (number + due date), and record
 * payments (bank transfer or a payment link from your payment gateway).
 */
export function invoicingService(
  db: PrismaClient,
  seller: SellerConfig = readSellerConfig(),
) {
  async function requireSuperadmin(tx: Tx | PrismaClient, sessionId: string) {
    const session = await requireActor(tx, sessionId);
    if (session.user.platformRole !== "SUPERADMIN")
      throw new AccessError("FORBIDDEN");
    return session;
  }

  async function adminList(sessionId: string) {
    await requireSuperadmin(db, sessionId);
    const rows = await db.billingInvoice.findMany({
      include: { organization: { select: { name: true } } },
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
      take: 500,
    });
    const now = new Date();
    return {
      sellerConfigured: sellerConfigured(seller),
      suggestedPeriod: recentJakartaMonths(now, 2)[1],
      invoices: rows.map(view),
    };
  }

  async function adminCommand(sessionId: string, raw: unknown) {
    const command = invoiceAdminCommandSchema.parse(raw);
    return db.$transaction(async (tx) => {
      const session = await requireSuperadmin(tx, sessionId);
      const now = await databaseNow(tx);

      if (command.action === "generate") {
        const { start, end } = monthBounds(command.period);
        const startDate = new Date(`${command.period}-01T00:00:00Z`);
        const offers = await tx.organizationOffer.findMany({
          where: {
            pricingModel: "PER_INVOICE",
            effectiveFrom: { lt: new Date(end.getTime() + DAY_MS) },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: startDate } }],
          },
          include: { organization: true },
        });
        let created = 0;
        for (const offer of offers) {
          const exists = await tx.billingInvoice.findFirst({
            where: {
              organizationId: offer.organizationId,
              period: command.period,
              status: { not: "VOID" },
            },
          });
          if (exists) continue;
          const count = await tx.entitledUsage.count({
            where: {
              organizationId: offer.organizationId,
              planCode: PER_INVOICE_PLAN_CODE,
              createdAt: { gte: start, lt: end },
            },
          });
          const price = offer.pricePerInvoiceIdr.toFixed(2);
          const minimum = offer.minimumMonthlyIdr.toFixed(2);
          const subtotal = perInvoiceCharge(count, price, minimum);
          const rate = offer.vatRatePercent.toFixed(2);
          const vat = vatAmount(subtotal, rate);
          const owner = await tx.membership.findFirst({
            where: { organizationId: offer.organizationId, role: "OWNER" },
            include: { user: { select: { name: true, email: true } } },
            orderBy: { createdAt: "asc" },
          });
          await tx.billingInvoice.create({
            data: {
              organizationId: offer.organizationId,
              number: `DRAFT-${offer.organizationId}-${command.period}-${now.getTime()}`,
              period: command.period,
              invoiceCount: count,
              pricePerInvoiceIdr: price,
              minimumMonthlyIdr: minimum,
              subtotalIdr: subtotal,
              vatRatePercent: rate,
              vatIdr: vat,
              totalIdr: addAmounts(subtotal, vat),
              offerReference: offer.offerReference,
              sellerSnapshot: {},
              buyerSnapshot: {
                name: offer.organization.legalName,
                workspace: offer.organization.name,
                contactName: owner?.user.name ?? null,
                contactEmail: owner?.user.email ?? null,
              },
              createdBy: session.userId,
            },
          });
          created += 1;
        }
        return { created };
      }

      const invoice = await tx.billingInvoice.findUnique({
        where: { id: command.invoiceId },
        include: { organization: { include: { offer: true } } },
      });
      if (!invoice) throw new InvoiceError("NOT_FOUND");

      if (command.action === "issue") {
        if (invoice.status !== "DRAFT") throw new InvoiceError("INVALID_STATE");
        if (!sellerConfigured(seller))
          throw new InvoiceError("SELLER_NOT_CONFIGURED");
        if (
          command.paymentLink &&
          !isSafeHttpsEndpointUrl(command.paymentLink.split("?")[0])
        )
          throw new InvoiceError("INVALID_PAYMENT_LINK");
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('serentax-invoice-number'))`;
        const today = jakartaDate(now);
        const base = `${seller.prefix}/${today.slice(0, 4)}/${today.slice(5, 7)}/`;
        const issuedThisMonth = await tx.billingInvoice.count({
          where: { number: { startsWith: base } },
        });
        const number = `${base}${String(issuedThisMonth + 1).padStart(4, "0")}`;
        const termDays = invoice.organization.offer?.paymentTermDays ?? 14;
        await tx.billingInvoice.update({
          where: { id: invoice.id },
          data: {
            status: "ISSUED",
            number,
            issuedAt: now,
            dueAt: new Date(now.getTime() + termDays * DAY_MS),
            paymentLink: command.paymentLink ?? null,
            sellerSnapshot: { ...seller },
            updatedBy: session.userId,
          },
        });
        await tx.workspaceAudit.create({
          data: {
            organizationId: invoice.organizationId,
            actorId: session.userId,
            action: "INVOICE_ISSUED",
            targetId: invoice.id,
          },
        });
        return { number };
      }

      if (command.action === "mark_paid") {
        if (invoice.status !== "ISSUED")
          throw new InvoiceError("INVALID_STATE");
        await tx.billingInvoice.update({
          where: { id: invoice.id },
          data: {
            status: "PAID",
            paidAt: new Date(`${command.paidOn}T00:00:00+07:00`),
            paymentMethod: command.method,
            paymentReference: command.reference,
            updatedBy: session.userId,
          },
        });
        await tx.workspaceAudit.create({
          data: {
            organizationId: invoice.organizationId,
            actorId: session.userId,
            action: "INVOICE_PAID",
            targetId: invoice.id,
          },
        });
        return { ok: true };
      }

      if (invoice.status !== "DRAFT" && invoice.status !== "ISSUED")
        throw new InvoiceError("INVALID_STATE");
      await tx.billingInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "VOID",
          voidReason: command.reason,
          updatedBy: session.userId,
        },
      });
      await tx.workspaceAudit.create({
        data: {
          organizationId: invoice.organizationId,
          actorId: session.userId,
          action: "INVOICE_VOIDED",
          targetId: invoice.id,
        },
      });
      return { ok: true };
    });
  }

  /** Customer view: issued, paid and voided invoices of the active workspace. */
  async function listForWorkspace(sessionId: string) {
    const session = await requireActor(db, sessionId);
    if (!session.activeOrganizationId) throw new AccessError("NO_WORKSPACE");
    await requireMembership(db, sessionId, session.activeOrganizationId);
    const rows = await db.billingInvoice.findMany({
      where: {
        organizationId: session.activeOrganizationId,
        status: { not: "DRAFT" },
      },
      include: { organization: { select: { name: true } } },
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
      take: 120,
    });
    return { invoices: rows.map(view) };
  }

  /** Single invoice for the printable view (members of that workspace, or superadmins). */
  async function getInvoice(sessionId: string, invoiceId: string) {
    const session = await requireActor(db, sessionId);
    const row = await db.billingInvoice.findUnique({
      where: { id: invoiceId },
      include: { organization: { select: { name: true } } },
    });
    if (!row) throw new InvoiceError("NOT_FOUND");
    if (session.user.platformRole !== "SUPERADMIN") {
      if (row.status === "DRAFT") throw new InvoiceError("NOT_FOUND");
      await requireMembership(db, sessionId, row.organizationId).catch(() => {
        throw new InvoiceError("NOT_FOUND");
      });
    }
    return view(row);
  }

  return { adminList, adminCommand, listForWorkspace, getInvoice };
}
