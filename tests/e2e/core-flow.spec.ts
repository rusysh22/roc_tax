import { expect, test, type Browser, type Page } from "@playwright/test";

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
  // A fresh session lands directly in the user's workspace.
  await expect(
    page.getByRole("heading", { name: "PT Demo Serentak Nusantara" }),
  ).toBeVisible();
  sessions.set(email, await context.storageState());
  return page;
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

  // ---- Preparer: create a draft through the form (subscription quota). ----
  const preparer = await signIn(browser, PREPARER);
  await expect(
    preparer.getByRole("region", { name: "Kuota langganan" }),
  ).toContainText("Langganan aktif");
  await preparer.goto("/id/app/transactions/new");
  await preparer
    .getByLabel("Perusahaan")
    .selectOption({ label: "Demo Serentak — Kantor Pusat" });
  await preparer
    .getByLabel("Lawan transaksi")
    .selectOption({ label: "PT Properti Gedung Contoh" });
  await preparer
    .getByLabel("Keluarga dokumen")
    .selectOption({ label: "BPPU · PPh Unifikasi" });
  await preparer.getByLabel("Nomor invoice").fill(invoice);
  await expect(preparer.getByLabel("Tanggal dokumen")).toHaveValue(
    jakartaToday(),
  );
  await expect(preparer.getByLabel("Masa pajak (YYYY-MM)")).toHaveValue(period);
  await preparer.getByLabel("Uraian baris #1").fill("Sewa gudang E2E");
  await preparer.getByLabel("Harga satuan (IDR) #1").fill(amount);
  await preparer.getByRole("button", { name: /^Simpan draf/ }).click();
  // The form lives at /transactions/new; wait for the redirect to the new draft.
  await preparer.waitForURL(
    (url) =>
      /\/id\/app\/transactions\/[^/]+$/.test(url.pathname) &&
      !url.pathname.endsWith("/new"),
  );
  const detailUrl = preparer.url();
  await expect(preparer.getByRole("heading", { name: invoice })).toBeVisible();

  // ---- Preparer: evaluate with an approved rule, then submit. ----
  await preparer.getByLabel("Kode objek pajak").fill("DEMO-42-SEWA-TB");
  await preparer.getByRole("button", { name: "Evaluasi aturan pajak" }).click();
  await expect(preparer.getByText("DEMO-PPH42-SEWA-TB v1")).toBeVisible();
  await expect(
    preparer.getByText("Tidak ada penghambat data pada aturan terpilih."),
  ).toBeVisible();
  await expect(preparer.getByText("Tervalidasi").first()).toBeVisible();
  await preparer.getByRole("button", { name: "Ajukan untuk tinjauan" }).click();
  await expect(preparer.getByText("Diajukan").first()).toBeVisible();
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
  await expect(approver.getByText("Disetujui").first()).toBeVisible();
  await expect(
    approver.getByText("Belum ada snapshot persetujuan."),
  ).toHaveCount(0);

  // ---- Preparer: generate the BPPU XML batch and download it. ----
  // Export versions are append-only per company + period; compute the next one.
  const before = (await (
    await preparer.request.get("/api/exports")
  ).json()) as {
    batches: {
      companyName: string;
      taxPeriod: string;
      exportVersion: number;
    }[];
  };
  const nextVersion =
    Math.max(
      0,
      ...before.batches
        .filter(
          (b) =>
            b.companyName === "Demo Serentak — Kantor Pusat" &&
            b.taxPeriod === period,
        )
        .map((b) => b.exportVersion),
    ) + 1;
  await preparer.goto("/id/app/exports");
  await preparer
    .getByLabel("Perusahaan pemotong")
    .selectOption({ label: "Demo Serentak — Kantor Pusat" });
  await preparer.getByLabel("Masa pajak (YYYY-MM)").fill(period);
  const row = preparer.locator("label", { hasText: invoice });
  await expect(row).toBeVisible();
  await row.getByRole("checkbox").check();
  await preparer
    .getByRole("button", { name: "Buat XML Coretax (immutable)" })
    .click();
  const batch = preparer
    .locator("article")
    .filter({ hasText: `${period}` })
    .filter({ hasText: `BPPU-${period}-v${nextVersion}.xml` });
  await expect(batch).toBeVisible();

  const download = batch.getByRole("link", { name: "Unduh XML" });
  const href = await download.getAttribute("href");
  const xml = await (await preparer.request.get(href!)).text();
  expect(xml).toContain("<BpuBulk");
  expect(xml).toContain(invoice);
  expect(xml).toContain("<TaxObjectCode>DEMO-42-SEWA-TB</TaxObjectCode>");
  expect(xml).toContain("<Rate>10</Rate>");

  // ---- Preparer: record the manual Coretax upload outcome. ----
  await batch
    .getByLabel("Catat hasil unggah manual Coretax")
    .selectOption("CORETAX_SUBMITTED");
  await batch
    .getByLabel("Nomor referensi / tanda terima Coretax (opsional)")
    .fill(`E2E-UPLOAD-${stamp}`);
  await batch.getByRole("button", { name: "Simpan catatan hasil" }).click();
  await expect(batch).toContainText(`CORETAX_SUBMITTED (E2E-UPLOAD-${stamp})`);

  // ---- Reconciliation reflects the exported transaction. ----
  await preparer.goto("/id/app/reconciliation");
  await expect(preparer.getByText(invoice)).toBeVisible();
});

test("superadmin consoles and role boundaries", async ({ browser }) => {
  const owner = await signIn(browser, OWNER);
  for (const path of [
    "/id/admin",
    "/id/admin/tax-rules",
    "/id/admin/xml-templates",
    "/id/admin/billing",
  ]) {
    await owner.goto(path);
    await expect(owner.locator("main h1")).toBeVisible();
  }
  await owner.goto("/id/admin/tax-rules");
  await expect(owner.getByText("DEMO-PPH23-JASA").first()).toBeVisible();

  // A preparer cannot open the superadmin console.
  const preparer = await signIn(browser, PREPARER);
  const response = await preparer.request.get("/api/admin/overview");
  expect(response.status()).toBe(403);
  // Owners do not implicitly prepare drafts.
  const created = await owner.request.post("/api/transactions", {
    headers: { origin: "http://127.0.0.1:3000" },
    data: { action: "check", draft: {} },
  });
  expect([400, 403]).toContain(created.status());
});
