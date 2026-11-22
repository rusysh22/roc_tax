import { describe, expect, it } from "vitest";
import {
  leadSchema,
  perInvoiceCharge,
  recentJakartaMonths,
} from "../../apps/web/src/server/sales/service";
import {
  vatAmount,
  addAmounts,
  sellerConfigured,
  readSellerConfig,
} from "../../apps/web/src/server/invoicing/service";
import { lifecycleConfig } from "../../apps/web/src/server/lifecycle/state";

describe("per-invoice pricing", () => {
  it("charges invoices x price with a monthly minimum, decimal-safe", () => {
    expect(perInvoiceCharge(0, "1500.00", "0.00")).toBe("0.00");
    expect(perInvoiceCharge(3, "1500.00", "0.00")).toBe("4500.00");
    expect(perInvoiceCharge(3, "1500.00", "5000.00")).toBe("5000.00");
    expect(perInvoiceCharge(1000001, "0.10", "0.00")).toBe("100000.10");
  });

  it("lists the last Asia/Jakarta months, crossing year boundaries", () => {
    // 2026-01-31 20:00 UTC is already 1 Feb in Jakarta (UTC+7).
    expect(recentJakartaMonths(new Date("2026-01-31T20:00:00Z"), 3)).toEqual([
      "2026-02",
      "2026-01",
      "2025-12",
    ]);
  });

  it("validates the public registration form", () => {
    const base = {
      companyName: "PT Contoh",
      picName: "Ani",
      email: "ANI@Example.test",
      phone: "+62 812 3456 7890",
      locale: "id",
    };
    const ok = leadSchema.safeParse(base);
    expect(ok.success && ok.data.email).toBe("ani@example.test");
    expect(leadSchema.safeParse({ ...base, phone: "12" }).success).toBe(false);
    expect(leadSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
  });
});

describe("invoice arithmetic and configuration", () => {
  it("computes VAT half-up from the offer rate, decimal-safe", () => {
    expect(vatAmount("5000.00", "11")).toBe("550.00");
    expect(vatAmount("1234.56", "11.00")).toBe("135.80");
    expect(vatAmount("0.05", "11")).toBe("0.01");
    expect(vatAmount("1000.00", "0")).toBe("0.00");
    expect(addAmounts("5000.00", "550.00")).toBe("5550.00");
  });

  it("refuses to issue invoices until issuer details are configured", () => {
    expect(sellerConfigured(readSellerConfig({}))).toBe(false);
    expect(readSellerConfig({}).prefix).toBe("INV/SRX");
    expect(
      sellerConfigured(
        readSellerConfig({
          BILLING_SELLER_NAME: "PT A",
          BILLING_SELLER_ADDRESS: "Jakarta",
          BILLING_BANK_NAME: "Bank",
          BILLING_BANK_ACCOUNT_NO: "1",
          BILLING_BANK_ACCOUNT_NAME: "PT A",
        }),
      ),
    ).toBe(true);
  });

  it("reads lifecycle policy from env with safe defaults", () => {
    expect(lifecycleConfig({})).toEqual({
      noticeDays: 30,
      retentionDays: null,
      suspendAfterOverdueDays: null,
    });
    expect(
      lifecycleConfig({
        DATA_TERMINATION_NOTICE_DAYS: "14",
        DATA_RETENTION_DAYS_AFTER_TERMINATION: "90",
        BILLING_SUSPEND_AFTER_DAYS_OVERDUE: "abc",
      }),
    ).toEqual({
      noticeDays: 14,
      retentionDays: 90,
      suspendAfterOverdueDays: null,
    });
  });
});
