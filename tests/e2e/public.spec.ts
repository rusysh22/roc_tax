import { test, expect } from "@playwright/test";
import { siteMessages } from "../../apps/web/src/i18n/site";
test("public navigation, truthful catalog, legal placeholders and persistent theme", async ({
  page,
}) => {
  for (const locale of ["id", "en"] as const) {
    const t = siteMessages[locale];
    await page.goto(`/${locale}`);
    const footer = page.getByRole("navigation", { name: t.footer });
    await footer.getByRole("link", { name: t.features, exact: true }).click();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(9);
    await expect(page.getByRole("table")).not.toContainText(t.current);
    await page
      .getByRole("navigation", { name: t.footer })
      .getByRole("link", { name: t.pricing, exact: true })
      .click();
    await expect(page.locator("[data-billing-state]")).toHaveAttribute(
      "data-billing-state",
      "NOT_CONFIGURED",
    );
    await expect(
      page.getByRole("heading", { name: t.catalogPending, exact: true }),
    ).toBeVisible();
    for (const slug of ["terms", "privacy"] as const) {
      await page
        .getByRole("navigation", { name: t.footer })
        .getByRole("link", { name: t[slug], exact: true })
        .click();
      await expect(
        page.getByText(t.legalPending, { exact: true }),
      ).toBeVisible();
    }
    await page
      .getByRole("navigation", { name: t.footer })
      .getByRole("link", { name: t.faq, exact: true })
      .click();
    const question = page.locator("main summary").first();
    await question.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText(t.questions[0].a, { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: t.footer })
      .getByRole("link", { name: t.workflow, exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      t.workflow,
    );
    await page
      .getByRole("navigation", { name: t.footer })
      .getByRole("link", { name: t.security, exact: true })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      t.security,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("link", { name: "Bahasa Indonesia", exact: true })
    .click();
  await expect(page).toHaveURL(/\/id\/security$/);
  await page.getByRole("button", { name: siteMessages.id.theme }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: test.info().outputPath("security-dark.png"),
    fullPage: true,
  });
});
test("default Indonesian route switches to English without overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/id$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Persiapan pajak, lebih tertata.",
  );
  await page.getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Tax preparation, thoughtfully organized.",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("public-page.png"),
    fullPage: true,
  });
});
test("unknown locales and anonymous workspace data fail closed", async ({
  request,
}) => {
  expect((await request.get("/fr")).status()).toBe(404);
  expect([401, 503]).toContain((await request.get("/api/workspaces")).status());
  expect([401, 503]).toContain((await request.get("/api/trial")).status());
  expect([401, 503]).toContain((await request.get("/api/companies")).status());
  expect([401, 503]).toContain(
    (await request.get("/api/counterparties")).status(),
  );
  expect([401, 503]).toContain(
    (await request.get("/api/transactions")).status(),
  );
  expect([401, 503]).toContain((await request.get("/api/imports")).status());
  expect([401, 503]).toContain(
    (await request.get("/api/imports/template")).status(),
  );
  expect([401, 503]).toContain(
    (await request.get("/api/ocr/settings")).status(),
  );
  expect([401, 503]).toContain(
    (await request.get("/api/admin/ocr-providers")).status(),
  );
  expect([401, 503]).toContain(
    (await request.get("/api/admin/tax-rules")).status(),
  );
  expect([401, 503]).toContain(
    (await request.get("/api/admin/xml-templates")).status(),
  );
  expect([401, 503]).toContain((await request.get("/api/tax/policy")).status());
  expect([401, 503]).toContain((await request.get("/api/exports")).status());
  expect([401, 503]).toContain((await request.get("/api/billing")).status());
  expect([401, 503]).toContain(
    (await request.get("/api/admin/billing")).status(),
  );
  expect([401, 503]).toContain(
    (await request.get("/api/reports/reconciliation")).status(),
  );
  expect([401, 503]).toContain(
    (await request.get("/api/reports/reconciliation/export")).status(),
  );
  expect([401, 503]).toContain(
    (await request.get("/api/workspaces/support-access")).status(),
  );
  expect([401, 503]).toContain(
    (await request.get("/api/admin/overview")).status(),
  );
  expect([401, 409, 502, 503]).toContain(
    (
      await request.post("/api/webhooks/berlanggan", {
        data: { event_id: "e1", event_type: "license.issued" },
      })
    ).status(),
  );
});
test("health exposes no infrastructure details and includes security headers", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", check: "liveness" });
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-powered-by"]).toBeUndefined();
});
