import { test, expect } from "@playwright/test";
import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { postgresOptions } from "../../apps/web/src/server/postgres";
import { PrismaClient } from "../../apps/web/src/generated/prisma/client";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("An isolated _test database is required");
const db = new PrismaClient({
  adapter: new PrismaPg(postgresOptions(url)),
});
const suffix = randomUUID();
const email = `browser-${suffix}@example.test`;
const invitedEmail = `invited-${suffix}@example.test`;
const password = "Synthetic-browser-password-498!";
const mailbox: { to: string; text: string }[] = [];
const smtp = new SMTPServer({
  authOptional: true,
  disabledCommands: ["AUTH", "STARTTLS"],
  logger: false,
  onData(stream, session, callback) {
    simpleParser(stream)
      .then((mail) => {
        mailbox.push({
          to: session.envelope.rcptTo[0].address,
          text: mail.text ?? "",
        });
        callback();
      })
      .catch(() => callback(new Error("Synthetic mail parsing failure")));
  },
});
async function mailLink(recipient: string, marker: string) {
  await expect
    .poll(
      () =>
        mailbox.filter(
          (mail) => mail.to === recipient && mail.text.includes(marker),
        ).length,
    )
    .toBeGreaterThan(0);
  return mailbox
    .filter((mail) => mail.to === recipient && mail.text.includes(marker))
    .at(-1)!
    .text.match(/https?:\/\/\S+/)![0];
}
test.beforeAll(async () => {
  await new Promise<void>((resolve) => smtp.listen(1026, "127.0.0.1", resolve));
});
test.afterAll(async () => {
  const users = await db.user.findMany({
    where: { email: { in: [email, invitedEmail] } },
    select: { id: true },
  });
  const memberships = await db.membership.findMany({
    where: { userId: { in: users.map((user) => user.id) }, role: "OWNER" },
  });
  await db.organization.deleteMany({
    where: { id: { in: memberships.map((m) => m.organizationId) } },
  });
  await db.trialUsage.deleteMany({
    where: { userId: { in: users.map((user) => user.id) } },
  });
  await db.trialAccount.deleteMany({
    where: { userId: { in: users.map((user) => user.id) } },
  });
  await db.user.deleteMany({
    where: { id: { in: users.map((user) => user.id) } },
  });
  await db.$disconnect();
  await new Promise<void>((resolve) => smtp.close(resolve));
});
test("verified signup, profile, workspace invitation and password recovery through real SMTP", async ({
  page,
  browser,
}) => {
  await page.goto("/en/app");
  const rejectedOrigin = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: "https://attacker.example" },
    data: { email, password },
  });
  expect(rejectedOrigin.status()).toBe(403);
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await page.goto("/en/auth/sign-up");
  await page
    .getByLabel("Name", { exact: true })
    .fill("Synthetic Browser Owner");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "instructions will be emailed",
  );
  await page.goto(await mailLink(email, "/verify-email?"));
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Home menu (Odoo-style app grid); no workspace is active yet.
  await expect(
    page.getByRole("heading", { name: "Apps", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("dashboard.png"),
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Manage workspaces", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Account & workspaces" }),
  ).toBeVisible();
  await expect(
    page.getByText("No active workspace.", { exact: false }),
  ).toBeVisible();
  const trialPanel = page.getByRole("region", { name: "Account trial" });
  await expect(trialPanel).toContainText("Trial not activated.");
  const refused = await page.request.post("/api/trial", {
    headers: { origin: "https://attacker.example" },
    data: { action: "activate" },
  });
  expect(refused.status()).toBe(403);
  const injected = await page.request.post("/api/trial", {
    headers: { origin: "http://127.0.0.1:3000" },
    data: { action: "activate", userId: "someone-else" },
  });
  expect(injected.status()).toBe(400);
  await trialPanel
    .getByRole("button", { name: "Activate 72-hour trial", exact: true })
    .click();
  await expect(trialPanel).toContainText("Trial active.");
  await expect(trialPanel).toContainText("WIB");
  await expect(
    trialPanel.getByRole("button", {
      name: "Activate 72-hour trial",
      exact: true,
    }),
  ).toHaveCount(0);
  const activated = await (await page.request.get("/api/trial")).json();
  const replay = await (
    await page.request.post("/api/trial", {
      headers: { origin: "http://127.0.0.1:3000" },
      data: { action: "activate" },
    })
  ).json();
  expect(replay.activatedAt).toBe(activated.activatedAt);
  expect(replay.remainingToday).toBe(1);
  expect(replay.remainingTotal).toBe(3);
  await page.reload();
  await expect(trialPanel).toContainText("Trial active.");
  await page
    .getByLabel("Workspace name", { exact: true })
    .fill("Synthetic browser workspace");
  await page
    .getByLabel("Legal entity name", { exact: true })
    .fill("Synthetic browser entity");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Team", exact: true }),
  ).toBeVisible();
  const original = await (await page.request.get("/api/workspaces")).json();
  const created = await page.request.post("/api/workspaces", {
    headers: { origin: "http://127.0.0.1:3000" },
    data: {
      action: "create",
      name: "Synthetic second workspace",
      legalName: "Synthetic second entity",
    },
  });
  expect(created.ok()).toBe(true);
  await page.reload();
  // Workspace switcher lives in the navbar menu.
  await page.getByRole("button", { name: /^Active workspace:/ }).click();
  await page
    .getByRole("menuitemcheckbox", { name: "Synthetic browser workspace" })
    .click();
  await page.waitForLoadState("load");
  expect(original.active.id).toBeTruthy();
  await expect(
    page.getByRole("heading", {
      name: "Synthetic browser workspace",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Name", { exact: true })
    .fill("Synthetic Updated Owner");
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect(page.getByTestId("account-feedback")).toContainText(
    "Changes saved",
  );
  await page.getByLabel("Email", { exact: true }).fill(invitedEmail);
  await page
    .getByRole("button", { name: "Invite member", exact: true })
    .click();
  const invitation = await mailLink(invitedEmail, "/invite#");
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  try {
    await memberPage.goto("/en/auth/sign-up");
    await memberPage
      .getByLabel("Name", { exact: true })
      .fill("Synthetic Invited Member");
    await memberPage.getByLabel("Email", { exact: true }).fill(invitedEmail);
    await memberPage.getByLabel("Password", { exact: true }).fill(password);
    await memberPage
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await memberPage.goto(await mailLink(invitedEmail, "/verify-email?"));
    await memberPage.getByLabel("Email", { exact: true }).fill(invitedEmail);
    await memberPage.getByLabel("Password", { exact: true }).fill(password);
    await memberPage
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(memberPage).toHaveURL(/\/en\/app$/);
    await memberPage.goto(invitation);
    await memberPage.getByRole("button", { name: "Accept invitation" }).click();
    await expect(
      memberPage.getByRole("heading", {
        name: "Synthetic browser workspace",
        exact: true,
      }),
    ).toBeVisible();
    await memberPage
      .getByRole("link", { name: "Manage workspaces", exact: true })
      .click();
    await expect(
      memberPage.getByRole("heading", { name: "Team", exact: true }),
    ).toHaveCount(0);
    const crossOrigin = await memberPage.request.post("/api/workspaces", {
      headers: { origin: "https://attacker.example" },
      data: {
        action: "create",
        name: "Invalid request",
        legalName: "Invalid request",
      },
    });
    expect(crossOrigin.status()).toBe(403);

    // Owner adds a company profile; invited Preparer adds a counterparty, activates their trial,
    // creates a manual draft, uploads a synthetic PDF, and comments.
    const companyCreated = await page.request.post("/api/companies", {
      headers: { origin: "http://127.0.0.1:3000" },
      data: {
        action: "create",
        company: {
          name: "Synthetic Head Office",
          legalName: "PT Synthetic Browser Entity",
          npwp: "01.234.567.8-901.000",
          nitku: "0123456789012345000001",
        },
      },
    });
    expect(companyCreated.ok()).toBe(true);
    const companyId = (await companyCreated.json()).id as string;

    // Standard list view → New → form view → Save.
    await memberPage
      .getByRole("link", { name: "Counterparties", exact: true })
      .click();
    await memberPage
      .getByRole("link", { name: "New", exact: true })
      .first()
      .click();
    await memberPage
      .getByLabel("Counterparty name")
      .fill("PT Synthetic Supplier");
    await memberPage
      .getByLabel("Tax identity number", { exact: true })
      .fill("9876543210987654");
    await memberPage.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      memberPage.getByRole("heading", { name: "PT Synthetic Supplier" }),
    ).toBeVisible();

    const activateMemberTrial = await memberPage.request.post("/api/trial", {
      headers: { origin: "http://127.0.0.1:3000" },
      data: { action: "activate" },
    });
    expect(activateMemberTrial.ok()).toBe(true);

    await memberPage
      .getByRole("link", { name: "Transactions", exact: true })
      .click();
    await memberPage
      .getByRole("link", { name: "New", exact: true })
      .first()
      .click();
    await memberPage.waitForURL(/\/transactions\/new$/);
    const counterpartyPicker = memberPage.getByRole("combobox", {
      name: "Counterparty",
      exact: true,
    });
    await counterpartyPicker.click();
    await counterpartyPicker.fill("Synthetic Supplier");
    await memberPage
      .getByRole("option", { name: /PT Synthetic Supplier/ })
      .click();
    await memberPage.getByLabel("Invoice number").fill("INV-E2E-001");
    await memberPage
      .getByLabel("Line description #1", { exact: true })
      .fill("Synthetic consulting service");
    await memberPage.getByLabel("Quantity #1", { exact: true }).fill("2");
    await memberPage
      .getByLabel("Unit price (IDR) #1", { exact: true })
      .fill("150000.00");
    await memberPage.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      memberPage.getByRole("heading", { name: "INV-E2E-001", exact: true }),
    ).toBeVisible();
    const txUrl = new URL(memberPage.url());
    const txId = txUrl.pathname.split("/").pop()!;
    const uploadResponse = await memberPage.request.post(
      `/api/transactions/${txId}/documents`,
      {
        headers: {
          origin: "http://127.0.0.1:3000",
          "content-type": "application/pdf",
          "x-file-name": "synthetic-invoice.pdf",
        },
        data: Buffer.from("%PDF-1.4\n% synthetic test only\n"),
      },
    );
    expect(uploadResponse.status()).toBe(201);
    await memberPage.reload();
    await memberPage.getByRole("tab", { name: /Source documents/ }).click();
    await expect(
      memberPage.locator("span", { hasText: "synthetic-invoice.pdf" }).first(),
    ).toBeVisible();
    await memberPage
      .getByLabel("Write a comment", { exact: true })
      .fill("Synthetic preparer note");
    await memberPage.getByRole("button", { name: "Send", exact: true }).click();
    await expect(memberPage.getByText("Synthetic preparer note")).toBeVisible();
    expect(companyId.length).toBeGreaterThan(0);

    // Preparer navigates to Imports, downloads CSV/XLSX templates, and previews a mixed CSV.
    await memberPage
      .getByRole("link", { name: "Spreadsheet imports", exact: true })
      .first()
      .click();
    await expect(
      memberPage.getByRole("heading", {
        name: "Spreadsheet imports",
        exact: true,
      }),
    ).toBeVisible();
    const tplResponse = await memberPage.request.get(
      "/api/imports/template?format=xlsx&family=PPH_UNIFIKASI_BPPU",
    );
    expect(tplResponse.status()).toBe(200);
    const mixedCsv = [
      "invoice_number,document_date,tax_period,document_type,tax_family,counterparty_name,counterparty_tax_id,description,line_description,quantity,unit_price,currency",
      "IMP-E2E-1,2026-11-16,2026-11,SUPPLIER_INVOICE,UNCLASSIFIED,PT Synthetic Supplier,9876543210987654,Valid row,Service A,1,100000.00,IDR",
      "=CMD|'/C calc'!A0,2026-11-16,2026-11,SUPPLIER_INVOICE,UNCLASSIFIED,PT Synthetic Supplier,9876543210987654,Formula row,Service B,1,100000.00,IDR",
    ].join("\r\n");
    const previewResp = await memberPage.request.post("/api/imports", {
      headers: {
        origin: "http://127.0.0.1:3000",
        "content-type": "text/csv",
        "x-import-action": "preview",
        "x-company-id": companyId,
        "x-file-name": "mixed.csv",
      },
      data: Buffer.from(mixedCsv, "utf-8"),
    });
    expect(previewResp.status()).toBe(200);
    const previewJson = await previewResp.json();
    expect(previewJson.validRows).toBe(1);
    expect(previewJson.invalidRows).toBe(1);
    expect(previewJson.quotaBlockReason).toBe("DAILY_LIMIT");

    // Non-superadmin user cannot access platform OCR provider registry;
    // workspace OCR defaults to NONE/manual and Settings -> OCR works cleanly.
    const forbiddenAdminApi = await memberPage.request.get(
      "/api/admin/ocr-providers",
    );
    expect(forbiddenAdminApi.status()).toBe(403);
    await memberPage.goto("/en/admin/ocr-providers");
    await expect(
      memberPage.getByText(
        "Access denied. This page is restricted to platform Superadmins.",
      ),
    ).toBeVisible();
    await memberPage.goto("/en/app/settings/ocr");
    await expect(
      memberPage.getByRole("heading", {
        name: "Workspace OCR configuration",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      memberPage.getByText("NONE · Manual & spreadsheet entry only"),
    ).toBeVisible();
    await memberPage.goto(`/en/app/transactions/${txId}`);
    // OCR and tax review live in the form's notebook tabs.
    await memberPage.getByRole("tab", { name: "OCR", exact: true }).click();
    await expect(
      memberPage.getByRole("heading", {
        name: "OCR candidate extraction & side-by-side correction",
        exact: true,
      }),
    ).toBeVisible();
    await memberPage
      .getByRole("tab", { name: "Tax classification", exact: true })
      .click();
    const forbiddenTaxAdmin = await memberPage.request.get(
      "/api/admin/tax-rules",
    );
    expect(forbiddenTaxAdmin.status()).toBe(403);
    await memberPage
      .getByRole("tabpanel")
      .getByRole("button", { name: "Evaluate tax rule", exact: true })
      .click();
    await expect(
      memberPage.getByText("Validation blockers (must be resolved)"),
    ).toBeVisible();
    const forbiddenXmlAdmin = await memberPage.request.get(
      "/api/admin/xml-templates",
    );
    expect(forbiddenXmlAdmin.status()).toBe(403);
    await memberPage.goto("/en/admin/xml-templates");
    await expect(
      memberPage.getByText(
        "Access denied. This page is restricted to platform Superadmins.",
      ),
    ).toBeVisible();
    await memberPage.goto("/en/app/exports");
    await expect(
      memberPage.getByRole("heading", { name: "XML exports", exact: true }),
    ).toBeVisible();
    // Template availability is shown in the export wizard.
    await memberPage
      .getByRole("button", { name: "New", exact: true })
      .first()
      .click();
    const exportWizard = memberPage.getByRole("dialog");
    await expect(
      exportWizard.getByText("Available (source-verified template)"),
    ).toBeVisible();
    await exportWizard
      .getByRole("combobox", { name: "Tax family", exact: true })
      .click();
    await expect(
      memberPage
        .getByRole("option", { name: /Blocked \(TEMPLATE_UNVERIFIED\)/ })
        .first(),
    ).toBeVisible();
    await memberPage.keyboard.press("Escape");
    await exportWizard.getByRole("button", { name: "Cancel" }).click();
    const forbiddenBillingAdmin =
      await memberPage.request.get("/api/admin/billing");
    expect(forbiddenBillingAdmin.status()).toBe(403);
    await memberPage.goto("/en/admin/billing");
    await expect(
      memberPage.getByText(
        "Access denied. This page is restricted to platform Superadmins.",
      ),
    ).toBeVisible();
    await memberPage.goto("/en/app/settings/billing");
    await expect(
      memberPage.getByRole("heading", {
        name: "Workspace Subscription & Licensing",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      memberPage.getByText("BILLING_NOT_CONFIGURED / SAAS_LICENSING_PENDING"),
    ).toBeVisible();
    const forbiddenOverviewAdmin = await memberPage.request.get(
      "/api/admin/overview",
    );
    expect(forbiddenOverviewAdmin.status()).toBe(403);
    await memberPage.goto("/en/admin");
    await expect(
      memberPage.getByText(
        "Access denied. This page is restricted to platform Superadmins.",
      ),
    ).toBeVisible();
    await memberPage.goto("/en/app/reconciliation");
    await expect(
      memberPage.getByRole("heading", { name: "Reconciliation", exact: true }),
    ).toBeVisible();
    await expect(
      memberPage.getByText("recorded manually by users"),
    ).toBeVisible();
  } finally {
    await memberContext.close();
  }
  await page.screenshot({
    path: test.info().outputPath("account-workspace.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("account-workspace-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  const cookies = await page.context().cookies();
  expect(
    cookies.find((cookie) => cookie.name.includes("session_token"))?.httpOnly,
  ).toBe(true);
  const otherDevice = await browser.newContext();
  try {
    const signIn = await otherDevice.request.post("/api/auth/sign-in/email", {
      headers: { origin: "http://127.0.0.1:3000" },
      data: { email, password },
    });
    expect(signIn.status()).toBe(200);
    expect((await otherDevice.request.get("/api/workspaces")).status()).toBe(
      200,
    );
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "End other sessions", exact: true })
      .click();
    await expect
      .poll(async () =>
        (await otherDevice.request.get("/api/workspaces")).status(),
      )
      .toBe(401);
  } finally {
    await otherDevice.close();
  }
  await page.getByRole("link", { name: "Transactions", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Transactions",
  );
  await page
    .getByRole("link", { name: "Bahasa Indonesia", exact: true })
    .click();
  await expect(page).toHaveURL(/\/id\/app\/transactions$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Transaksi");
  await page.getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/app\/transactions$/);
  await page.getByRole("link", { name: "Apps menu", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: test.info().outputPath("dashboard-mobile.png"),
    fullPage: true,
  });
  // Mobile: the sidebar becomes a drawer.
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Main navigation" })
    .getByRole("link", { name: "Spreadsheet imports", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Spreadsheet imports",
  );
  await page.getByRole("button", { name: "User menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await page.goto("/en/auth/forgot");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Forgot password", exact: true })
    .click();
  await page.goto(await mailLink(email, "/reset-password/"));
  await page
    .getByLabel("Password", { exact: true })
    .fill("Synthetic-reset-password-498!");
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Password changed");
});
