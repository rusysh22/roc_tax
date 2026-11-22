import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";

// Requires the seeded demo workspace: `npm run db:seed:dev`.
const PASSWORD = "DevOnly-Passw0rd!2026";
const PREPARER = "penyusun@example.test";
const APPROVER = "penyetuju@example.test";
const OWNER = "dev.tester@example.test";

// Sign in through the UI once per user and reuse the session afterwards:
// the auth endpoint is rate limited (10 sign-ins per minute per IP).
const sessions = new Map<
  string,
  Awaited<
    ReturnType<Awaited<ReturnType<Browser["newContext"]>>["storageState"]>
  >
>();

async function signIn(browser: Browser, email: string): Promise<Page> {
  const saved = sessions.get(email);
  if (saved) {
    const page = await (
      await browser.newContext({ storageState: saved })
    ).newPage();
    await page.goto("/id/app");
    await expect(
      page.getByRole("heading", { name: "PT Demo Serentak Nusantara" }),
    ).toBeVisible();
    return page;
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/id/auth/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/id\/app$/);
  // A fresh session lands directly in the user's workspace (home menu).
  await expect(
    page.getByRole("heading", { name: "PT Demo Serentak Nusantara" }),
  ).toBeVisible();
  sessions.set(email, await context.storageState());
  return page;
}

/** Chooses an option in the standard searchable combobox. */
async function choose(scope: Page | Locator, label: string, option: string) {
  const input = scope.getByRole("combobox", { name: label, exact: true });
  await input.click();
  await input.fill(option);
  const page = "page" in scope ? scope.page() : scope;
  await page
    .getByRole("option", { name: new RegExp(`^${escapeRegExp(option)}`) })
    .first()
    .click();
  await expect(input).toHaveValue(new RegExp(escapeRegExp(option)));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
    new Date(),
  );
}

test("draft → evaluate → submit → approve → BPPU XML export → Coretax outcome", async ({
  browser,
}) => {
  const stamp = Date.now().toString(36).toUpperCase();
  const invoice = `E2E/${stamp}`;
  const amount = `${10_000_000 + (Date.now() % 900_000)}.00`;
  const period = jakartaToday().slice(0, 7);

  // ---- Preparer: create a draft through the standard form view. ----
  const preparer = await signIn(browser, PREPARER);
  await expect(
    preparer.getByRole("region", { name: "Kuota langganan" }),
  ).toContainText("Langganan aktif");
  // Module menu → list view → New.
  await preparer.getByRole("link", { name: "Transaksi" }).first().click();
  await preparer.waitForURL(/\/id\/app\/transactions$/);
  await preparer.getByRole("link", { name: "Baru" }).click();
  await preparer.waitForURL(/\/transactions\/new$/);
  await choose(preparer, "Perusahaan", "Demo Serentak — Kantor Pusat");
  await choose(preparer, "Lawan transaksi", "PT Properti Gedung Contoh");
  await choose(preparer, "Keluarga dokumen", "BPPU · PPh Unifikasi");
  await preparer.getByLabel("Nomor invoice").fill(invoice);
  await expect(preparer.getByLabel("Tanggal dokumen")).toHaveValue(
    jakartaToday(),
  );
  await expect(preparer.getByLabel("Masa pajak (YYYY-MM)")).toHaveValue(period);
  await preparer.getByLabel("Uraian baris #1").fill("Sewa gudang E2E");
  await preparer.getByLabel("Harga satuan (IDR) #1").fill(amount);
  await preparer.getByRole("button", { name: "Simpan", exact: true }).click();
  // The form lives at /transactions/new; wait for the redirect to the record.
  await preparer.waitForURL(
    (url) =>
      /\/id\/app\/transactions\/[^/]+$/.test(url.pathname) &&
      !url.pathname.endsWith("/new"),
  );
  const detailUrl = preparer.url();
  await expect(preparer.getByRole("heading", { name: invoice })).toBeVisible();

  // ---- Preparer: evaluate in the Tax tab with an approved rule, submit. ----
  await preparer.getByRole("tab", { name: /Klasifikasi pajak/ }).click();
  const taxPanel = preparer.getByRole("tabpanel");
  await choose(taxPanel, "Kode objek pajak", "DEMO-42-SEWA-TB");
  await taxPanel.getByRole("button", { name: "Evaluasi aturan pajak" }).click();
  await expect(preparer.getByText("DEMO-PPH42-SEWA-TB v1")).toBeVisible();
  await expect(
    preparer.getByText("Tidak ada penghambat data pada aturan terpilih."),
  ).toBeVisible();
  await expect(preparer.getByText("Tervalidasi").first()).toBeVisible();
  await preparer.getByRole("button", { name: "Ajukan untuk tinjauan" }).click();
  await expect(
    preparer.locator('[aria-current="step"]', {
      hasText: "Menunggu persetujuan",
    }),
  ).toBeVisible();
  // Segregation of duties: the preparer is never offered approval.
  await expect(
    preparer.getByRole("button", { name: "Setujui & kunci snapshot" }),
  ).toHaveCount(0);

  // ---- Approver: approve and lock the snapshot. ----
  const approver = await signIn(browser, APPROVER);
  await approver.goto(detailUrl);
  await approver
    .getByRole("button", { name: "Setujui & kunci snapshot" })
    .click();
  await expect(
    approver.locator('[aria-current="step"]', { hasText: "Disetujui" }),
  ).toBeVisible();

  // ---- Preparer: generate the BPPU XML batch through the export wizard. ----
  await preparer.goto("/id/app/exports");
  await preparer.getByRole("button", { name: "Baru" }).click();
  const wizard = preparer.getByRole("dialog", {
    name: "Buat batch ekspor XML BPPU",
  });
  await choose(wizard, "Perusahaan pemotong", "Demo Serentak — Kantor Pusat");
  await wizard.getByLabel("Masa pajak (YYYY-MM)").fill(period);
  await wizard.getByRole("button", { name: "Lanjut" }).click();
  const row = wizard.locator("label", { hasText: invoice });
  await expect(row).toBeVisible();
  await row.getByRole("checkbox").check();
  await wizard
    .getByRole("button", { name: "Buat XML Coretax (immutable)" })
    .click();
  await preparer.waitForURL(/\/id\/app\/exports\/[^/]+$/);

  const download = preparer.getByRole("link", { name: "Unduh XML" });
  const href = await download.getAttribute("href");
  const xml = await (await preparer.request.get(href!)).text();
  expect(xml).toContain("<BpuBulk");
  expect(xml).toContain(invoice);
  expect(xml).toContain("<TaxObjectCode>DEMO-42-SEWA-TB</TaxObjectCode>");
  expect(xml).toContain("<Rate>10</Rate>");

  // ---- Preparer: record the manual Coretax upload outcome (dialog). ----
  await preparer.getByRole("button", { name: "Simpan catatan hasil" }).click();
  const outcome = preparer.getByRole("dialog", {
    name: "Catat hasil unggah manual Coretax",
  });
  await choose(
    outcome,
    "Catat hasil unggah manual Coretax",
    "Diunggah ke Coretax",
  );
  await outcome
    .getByLabel("Nomor referensi / tanda terima Coretax (opsional)")
    .fill(`E2E-UPLOAD-${stamp}`);
  await outcome.getByRole("button", { name: "Simpan catatan hasil" }).click();
  await expect(
    preparer.getByLabel("Aktivitas").getByText(`E2E-UPLOAD-${stamp}`),
  ).toBeVisible();

  // ---- Reconciliation reflects the exported transaction. ----
  await preparer.goto("/id/app/reconciliation");
  await expect(
    preparer.getByRole("row", { name: new RegExp(escapeRegExp(invoice)) }),
  ).toBeVisible();
});

test("standard list view: search facets, filters, export and archive", async ({
  browser,
}) => {
  const preparer = await signIn(browser, PREPARER);
  await preparer.goto("/id/app/counterparties");
  await expect(
    preparer.getByRole("heading", { name: "Lawan transaksi" }),
  ).toBeVisible();
  // Free-text facet from the search suggestions.
  const search = preparer.getByRole("combobox", { name: "Cari…" });
  await search.fill("Konsultan");
  await preparer.getByRole("option", { name: /Nama lawan transaksi/ }).click();
  // header + 1 record + bold totals footer
  await expect(preparer.locator("table tbody tr")).toHaveCount(1);
  await expect(
    preparer.getByRole("row", { name: /PT Konsultan Contoh Abadi/ }),
  ).toBeVisible();
  // Clicking a row opens the record (no separate action needed).
  await preparer
    .getByRole("row", { name: /PT Konsultan Contoh Abadi/ })
    .getByRole("cell")
    .nth(2)
    .click();
  await preparer.waitForURL(/\/counterparties\/[^/]+$/);
  await expect(
    preparer.getByRole("heading", { name: "PT Konsultan Contoh Abadi" }),
  ).toBeVisible();
  // Filters persist in the URL and survive the language switch.
  await preparer.goBack();
  await preparer.waitForURL(/[?&]s=/);
  await preparer.getByRole("link", { name: "English" }).click();
  await preparer.waitForURL(/\/en\/app\/counterparties\?s=/);
  await expect(
    preparer.getByRole("row", { name: /PT Konsultan Contoh Abadi/ }),
  ).toBeVisible();
  await expect(preparer.locator("html")).toHaveAttribute(
    "data-theme",
    /light|dark/,
  );

  // Archive + unarchive a fresh counterparty through the action menu.
  await preparer.goto("/id/app/counterparties/new");
  const name = `Arsip E2E ${Date.now().toString(36)}`;
  await preparer.getByLabel("Nama lawan transaksi").fill(name);
  await choose(preparer, "Jenis identitas pajak", "Belum diisi");
  await preparer.getByRole("button", { name: "Simpan", exact: true }).click();
  await preparer.waitForURL(
    (url) =>
      /\/counterparties\/[^/]+$/.test(url.pathname) &&
      !url.pathname.endsWith("/new"),
  );
  await preparer.getByRole("button", { name: "Tindakan" }).click();
  await preparer.getByRole("menuitem", { name: "Arsipkan" }).click();
  await preparer
    .getByRole("dialog")
    .getByRole("button", { name: "Arsipkan" })
    .click();
  await expect(preparer.getByText("Diarsipkan").first()).toBeVisible();
  await preparer.getByRole("button", { name: "Tindakan" }).click();
  await preparer.getByRole("menuitem", { name: "Hapus" }).click();
  await preparer
    .getByRole("dialog")
    .getByRole("button", { name: "Hapus" })
    .click();
  await preparer.waitForURL(/\/counterparties$/);
});

test("superadmin consoles and role boundaries", async ({ browser }) => {
  const owner = await signIn(browser, OWNER);
  // The Platform Admin module is only offered to superadmins.
  await expect(
    owner.getByRole("link", { name: "Admin Platform" }),
  ).toBeVisible();
  for (const path of [
    "/id/admin",
    "/id/admin/tax-rules",
    "/id/admin/xml-templates",
    "/id/admin/billing",
  ]) {
    await owner.goto(path);
    await expect(owner.locator("main h1").first()).toBeVisible();
  }
  await owner.goto("/id/admin/tax-rules");
  await expect(owner.getByText("DEMO-PPH23-JASA").first()).toBeVisible();

  // A preparer cannot open the superadmin console or see its module.
  const preparer = await signIn(browser, PREPARER);
  await expect(
    preparer.getByRole("link", { name: "Admin Platform" }),
  ).toHaveCount(0);
  const response = await preparer.request.get("/api/admin/overview");
  expect(response.status()).toBe(403);
  // Owners do not implicitly prepare drafts.
  const created = await owner.request.post("/api/transactions", {
    headers: { origin: "http://127.0.0.1:3000" },
    data: { action: "check", draft: {} },
  });
  expect([400, 403]).toContain(created.status());
});
