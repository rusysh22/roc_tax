import type { Locale } from "./messages";

export type TourStepId =
  | "welcome"
  | "workspace"
  | "team"
  | "company"
  | "counterparty"
  | "transaction"
  | "approved"
  | "exported"
  | "done";

type StepText = { title: string; body: string; cta?: string };

export const onboardingMessages = {
  id: {
    guideName: "Panduan SerenTax",
    guideRole: "Asisten memulai",
    launcher: "Buka panduan memulai",
    menuItem: "Panduan memulai",
    stepOf: "Langkah {n} dari {total}",
    next: "Lanjut",
    back: "Kembali",
    skip: "Lewati panduan",
    finish: "Selesai",
    minimize: "Sembunyikan panduan",
    restart: "Ulangi dari awal",
    doneBadge: "Sudah selesai",
    progress: "{done} dari {total} langkah selesai",
    youSaid: "Anda",
    steps: {
      welcome: {
        title: "Halo, selamat datang di SerenTax 👋",
        body: "Saya akan menemani langkah pertama Anda: dari menyiapkan ruang kerja sampai mengunduh berkas XML untuk Coretax. Setiap langkah tercentang otomatis begitu Anda menyelesaikannya.",
      },
      workspace: {
        title: "1. Siapkan ruang kerja",
        body: "Ruang kerja adalah wadah untuk satu organisasi atau satu klien. Semua data, tim, dan langganan terpisah per ruang kerja.",
        cta: "Buka Ruang kerja",
      },
      team: {
        title: "2. Undang tim dan atur peran",
        body: "Undang rekan sebagai Penyusun, Peninjau, atau Pemberi persetujuan. Pemisahan peran mencegah satu orang menyetujui transaksinya sendiri.",
        cta: "Buka Tim",
      },
      company: {
        title: "3. Tambah perusahaan pemotong",
        body: "Isi nama, NPWP, dan NITKU perusahaan yang melakukan pemotongan pajak. NPWP disimpan terenkripsi.",
        cta: "Buka Perusahaan",
      },
      counterparty: {
        title: "4. Tambah lawan transaksi",
        body: "Daftarkan vendor atau pelanggan beserta identitas pajaknya, supaya bisa dipilih cepat saat membuat transaksi.",
        cta: "Buka Lawan transaksi",
      },
      transaction: {
        title: "5. Catat transaksi pertama",
        body: "Buat draf secara manual, impor dari spreadsheet, atau unggah faktur lalu baca isinya dengan OCR di tab OCR.",
        cta: "Buka Transaksi",
      },
      approved: {
        title: "6. Evaluasi pajak dan setujui",
        body: "Di tab Pajak, jalankan evaluasi aturan, ajukan untuk ditinjau, lalu Pemberi persetujuan mengunci hasilnya.",
        cta: "Lihat transaksi",
      },
      exported: {
        title: "7. Ekspor XML untuk Coretax",
        body: "Buat berkas XML dari transaksi yang disetujui, unggah manual ke Coretax, lalu catat hasilnya di SerenTax.",
        cta: "Buka Ekspor XML",
      },
      done: {
        title: "Semua siap! 🎉",
        body: "Anda sudah mengenal alur utama SerenTax. Panduan bisa dibuka lagi kapan saja dari menu profil, dan Pusat bantuan berisi penjelasan lebih lengkap.",
        cta: "Buka Pusat bantuan",
      },
    } satisfies Record<TourStepId, StepText>,
  },
  en: {
    guideName: "SerenTax guide",
    guideRole: "Getting-started assistant",
    launcher: "Open the getting-started guide",
    menuItem: "Getting-started guide",
    stepOf: "Step {n} of {total}",
    next: "Next",
    back: "Back",
    skip: "Skip guide",
    finish: "Finish",
    minimize: "Hide guide",
    restart: "Start over",
    doneBadge: "Done",
    progress: "{done} of {total} steps done",
    youSaid: "You",
    steps: {
      welcome: {
        title: "Hi, welcome to SerenTax 👋",
        body: "I'll walk you through your first steps: from setting up a workspace to downloading the XML file for Coretax. Each step ticks off automatically once you complete it.",
      },
      workspace: {
        title: "1. Set up a workspace",
        body: "A workspace holds one organization or one client. Data, team and subscription are kept separate per workspace.",
        cta: "Open Workspaces",
      },
      team: {
        title: "2. Invite your team and set roles",
        body: "Invite colleagues as Preparer, Reviewer or Approver. Separating roles prevents one person from approving their own transaction.",
        cta: "Open Team",
      },
      company: {
        title: "3. Add the withholding company",
        body: "Enter the name, tax ID and branch ID of the company that withholds tax. Tax IDs are stored encrypted.",
        cta: "Open Companies",
      },
      counterparty: {
        title: "4. Add counterparties",
        body: "Register vendors or customers with their tax identity so you can pick them quickly when creating transactions.",
        cta: "Open Counterparties",
      },
      transaction: {
        title: "5. Record your first transaction",
        body: "Create a draft manually, import a spreadsheet, or upload an invoice and read it with OCR in the OCR tab.",
        cta: "Open Transactions",
      },
      approved: {
        title: "6. Evaluate tax and approve",
        body: "In the Tax tab, evaluate the rules, submit for review, and the Approver locks the result.",
        cta: "View transactions",
      },
      exported: {
        title: "7. Export XML for Coretax",
        body: "Create the XML file from approved transactions, upload it to Coretax manually, then record the outcome in SerenTax.",
        cta: "Open XML exports",
      },
      done: {
        title: "You're all set! 🎉",
        body: "You now know the main SerenTax flow. Reopen this guide any time from the profile menu; the Help center has more detail.",
        cta: "Open Help center",
      },
    } satisfies Record<TourStepId, StepText>,
  },
} satisfies Record<Locale, unknown>;
