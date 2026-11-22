import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import {
  AMOUNT_SCALE,
  amountPattern,
  formatFixed,
  parseFixed,
} from "../../lib/intake/decimal";
import { validateIdentity } from "../../lib/intake/identity";
import type { TaxCrypto } from "../intake/crypto";
import { jakartaDate } from "../trial/state";
import { PER_INVOICE_PLAN_CODE, activePerInvoiceOffer } from "../trial/service";
import { AccessError } from "../workspaces/policy";
import { requireActor } from "../workspaces/service";

type Tx = Prisma.TransactionClient;

export class SalesError extends Error {
  constructor(public code: "RATE_LIMITED" | "INVALID_INPUT" | "NOT_FOUND") {
    super(code);
  }
}

/** Public sales-led registration form. `website` is a honeypot (must stay empty). */
export const leadSchema = z
  .object({
    companyName: z.string().trim().min(2).max(200),
    picName: z.string().trim().min(2).max(120),
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{8,20}$/),
    npwp: z
      .string()
      .trim()
      .max(32)
      .optional()
      .transform((v) => (v ? v : undefined)),
    estimatedMonthlyInvoices: z.coerce
      .number()
      .int()
      .min(0)
      .max(10_000_000)
      .optional(),
    message: z.string().trim().max(2000).default(""),
    locale: z.enum(["id", "en"]),
    website: z.string().max(0).optional(),
  })
  .strict();

export const salesAdminCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("lead_update"),
      leadId: z.string().min(1).max(100),
      status: z.enum(["NEW", "CONTACTED", "CONVERTED", "REJECTED"]),
      notes: z.string().trim().max(2000).default(""),
    })
    .strict(),
  z
    .object({
      action: z.literal("offer_upsert"),
      organizationId: z.string().min(1).max(100),
      pricingModel: z.enum(["SUBSCRIPTION", "PER_INVOICE"]),
      pricePerInvoiceIdr: z.string().trim().regex(amountPattern),
      minimumMonthlyIdr: z.string().trim().regex(amountPattern),
      vatRatePercent: z
        .string()
        .trim()
        .regex(/^\d{1,2}(\.\d{1,2})?$/)
        .default("0"),
      paymentTermDays: z.coerce.number().int().min(0).max(120).default(14),
      monthlyInvoiceCap: z.coerce
        .number()
        .int()
        .min(1)
        .max(10_000_000)
        .nullable(),
      offerReference: z.string().trim().min(2).max(120),
      effectiveFrom: z.iso.date(),
      effectiveTo: z.iso.date().nullable(),
      active: z.boolean(),
      notes: z.string().trim().max(2000).default(""),
    })
    .strict(),
]);

const MAX_LEADS_PER_HOUR = 5;

/** Monthly charge for a per-invoice offer: max(invoices × price, minimum). */
export function perInvoiceCharge(
  invoices: number,
  pricePerInvoice: string,
  minimum: string,
) {
  const usage = parseFixed(pricePerInvoice, AMOUNT_SCALE) * BigInt(invoices);
  const floor = parseFixed(minimum, AMOUNT_SCALE);
  return formatFixed(usage > floor ? usage : floor, AMOUNT_SCALE);
}

/** Last `count` Asia/Jakarta months (YYYY-MM), newest first. */
export function recentJakartaMonths(now: Date, count: number) {
  const [y, m] = jakartaDate(now).slice(0, 7).split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/** Metered usage + charges for the billing page (workspace members). */
export async function perInvoiceSummary(
  tx: Tx,
  organizationId: string,
  now: Date,
) {
  const offer = await tx.organizationOffer.findUnique({
    where: { organizationId },
  });
  if (!offer || offer.pricingModel !== "PER_INVOICE") return null;
  const months = recentJakartaMonths(now, 6);
  const since = new Date(`${months[months.length - 1]}-01T00:00:00+07:00`);
  const receipts = await tx.entitledUsage.findMany({
    where: {
      organizationId,
      planCode: PER_INVOICE_PLAN_CODE,
      createdAt: { gte: since },
    },
    select: { createdAt: true },
  });
  const counts = new Map<string, number>();
  for (const r of receipts) {
    const key = jakartaDate(r.createdAt).slice(0, 7);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const price = offer.pricePerInvoiceIdr.toFixed(2);
  const minimum = offer.minimumMonthlyIdr.toFixed(2);
  const rows = months.map((month) => {
    const invoices = counts.get(month) ?? 0;
    return {
      month,
      invoices,
      chargeIdr: perInvoiceCharge(invoices, price, minimum),
    };
  });
  const active = Boolean(await activePerInvoiceOffer(tx, organizationId, now));
  return {
    active,
    pricePerInvoiceIdr: price,
    minimumMonthlyIdr: minimum,
    monthlyInvoiceCap: offer.monthlyInvoiceCap,
    offerReference: offer.offerReference,
    effectiveFrom: offer.effectiveFrom.toISOString().slice(0, 10),
    effectiveTo: offer.effectiveTo?.toISOString().slice(0, 10) ?? null,
    months: rows,
  };
}

export function salesService(
  db: PrismaClient,
  crypto: TaxCrypto,
  options: {
    pepper: string;
    notify?: (lead: {
      companyName: string;
      picName: string;
      email: string;
      phone: string;
    }) => Promise<void>;
  },
) {
  async function requireSuperadmin(tx: Tx, sessionId: string) {
    const session = await requireActor(tx, sessionId);
    if (session.user.platformRole !== "SUPERADMIN")
      throw new AccessError("FORBIDDEN");
    return session;
  }

  async function submitLead(raw: unknown, requester: string) {
    const parsed = leadSchema.safeParse(raw);
    if (!parsed.success) throw new SalesError("INVALID_INPUT");
    const data = parsed.data;
    // Honeypot filled → pretend success, store nothing.
    if (data.website) return { ok: true };
    const npwp = data.npwp ? validateIdentity("NPWP", data.npwp) : undefined;
    if (data.npwp && !npwp) throw new SalesError("INVALID_INPUT");
    const requesterHash = createHash("sha256")
      .update(`${options.pepper}:${requester}`)
      .digest("hex");
    const created = await db.$transaction(async (tx) => {
      const recent = await tx.salesLead.count({
        where: {
          requesterHash,
          createdAt: { gte: new Date(Date.now() - 3_600_000) },
        },
      });
      if (recent >= MAX_LEADS_PER_HOUR) throw new SalesError("RATE_LIMITED");
      const protectedNpwp = npwp
        ? crypto.protect("platform", "LEAD_NPWP", npwp)
        : null;
      return tx.salesLead.create({
        data: {
          companyName: data.companyName,
          picName: data.picName,
          email: data.email,
          phone: data.phone,
          npwpCipher: protectedNpwp?.cipher ?? null,
          npwpHint: protectedNpwp?.hint ?? null,
          estimatedMonthlyInvoices: data.estimatedMonthlyInvoices ?? null,
          message: data.message,
          locale: data.locale,
          requesterHash,
        },
      });
    });
    await options
      .notify?.({
        companyName: created.companyName,
        picName: created.picName,
        email: created.email,
        phone: created.phone,
      })
      .catch(() => {});
    return { ok: true };
  }

  async function adminOverview(sessionId: string) {
    return db.$transaction(async (tx) => {
      await requireSuperadmin(tx, sessionId);
      const now = new Date();
      const monthStart = new Date(
        `${jakartaDate(now).slice(0, 7)}-01T00:00:00+07:00`,
      );
      const [leads, organizations, usage] = await Promise.all([
        tx.salesLead.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
        tx.organization.findMany({
          include: { offer: true, _count: { select: { memberships: true } } },
          orderBy: { name: "asc" },
          take: 500,
        }),
        tx.entitledUsage.groupBy({
          by: ["organizationId"],
          where: {
            planCode: PER_INVOICE_PLAN_CODE,
            createdAt: { gte: monthStart },
          },
          _count: { _all: true },
        }),
      ]);
      const usageMap = new Map(
        usage.map((u) => [u.organizationId, u._count._all]),
      );
      return {
        leads: leads.map((l) => ({
          id: l.id,
          companyName: l.companyName,
          picName: l.picName,
          email: l.email,
          phone: l.phone,
          npwpHint: l.npwpHint,
          estimatedMonthlyInvoices: l.estimatedMonthlyInvoices,
          message: l.message,
          locale: l.locale,
          status: l.status,
          notes: l.notes,
          createdAt: l.createdAt.toISOString(),
        })),
        workspaces: organizations.map((o) => {
          const invoices = usageMap.get(o.id) ?? 0;
          return {
            id: o.id,
            name: o.name,
            legalName: o.legalName,
            members: o._count.memberships,
            invoicesThisMonth: invoices,
            offer: o.offer
              ? {
                  pricingModel: o.offer.pricingModel,
                  pricePerInvoiceIdr: o.offer.pricePerInvoiceIdr.toFixed(2),
                  minimumMonthlyIdr: o.offer.minimumMonthlyIdr.toFixed(2),
                  vatRatePercent: o.offer.vatRatePercent.toFixed(2),
                  paymentTermDays: o.offer.paymentTermDays,
                  monthlyInvoiceCap: o.offer.monthlyInvoiceCap,
                  offerReference: o.offer.offerReference,
                  effectiveFrom: o.offer.effectiveFrom
                    .toISOString()
                    .slice(0, 10),
                  effectiveTo:
                    o.offer.effectiveTo?.toISOString().slice(0, 10) ?? null,
                  active: o.offer.active,
                  notes: o.offer.notes,
                  chargeThisMonthIdr:
                    o.offer.pricingModel === "PER_INVOICE"
                      ? perInvoiceCharge(
                          invoices,
                          o.offer.pricePerInvoiceIdr.toFixed(2),
                          o.offer.minimumMonthlyIdr.toFixed(2),
                        )
                      : null,
                }
              : null,
          };
        }),
      };
    });
  }

  async function adminCommand(sessionId: string, raw: unknown) {
    const command = salesAdminCommandSchema.parse(raw);
    return db.$transaction(async (tx) => {
      const session = await requireSuperadmin(tx, sessionId);
      if (command.action === "lead_update") {
        const found = await tx.salesLead.findUnique({
          where: { id: command.leadId },
        });
        if (!found) throw new SalesError("NOT_FOUND");
        await tx.salesLead.update({
          where: { id: command.leadId },
          data: {
            status: command.status,
            notes: command.notes,
            updatedBy: session.userId,
          },
        });
        return { ok: true };
      }
      const org = await tx.organization.findUnique({
        where: { id: command.organizationId },
      });
      if (!org) throw new SalesError("NOT_FOUND");
      if (command.effectiveTo && command.effectiveTo < command.effectiveFrom)
        throw new SalesError("INVALID_INPUT");
      const data = {
        pricingModel: command.pricingModel,
        pricePerInvoiceIdr: command.pricePerInvoiceIdr,
        minimumMonthlyIdr: command.minimumMonthlyIdr,
        vatRatePercent: command.vatRatePercent,
        paymentTermDays: command.paymentTermDays,
        monthlyInvoiceCap: command.monthlyInvoiceCap,
        offerReference: command.offerReference,
        effectiveFrom: new Date(`${command.effectiveFrom}T00:00:00Z`),
        effectiveTo: command.effectiveTo
          ? new Date(`${command.effectiveTo}T00:00:00Z`)
          : null,
        active: command.active,
        notes: command.notes,
        updatedBy: session.userId,
      };
      await tx.organizationOffer.upsert({
        where: { organizationId: command.organizationId },
        create: { organizationId: command.organizationId, ...data },
        update: data,
      });
      await tx.workspaceAudit.create({
        data: {
          organizationId: command.organizationId,
          actorId: session.userId,
          action: "OFFER_UPDATED",
          targetId: command.organizationId,
        },
      });
      return { ok: true };
    });
  }

  return { submitLead, adminOverview, adminCommand };
}
