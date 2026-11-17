export const locales = ["id", "en"] as const;
export type Locale = (typeof locales)[number];
export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value);
}
export const messages = {
  id: {
    title: "Persiapan pajak, lebih tertata.",
    description:
      "Ruang kerja untuk membantu tim akuntansi menyiapkan dan meninjau dokumen pajak Indonesia.",
    eyebrow: "Dokumen rapi. Tinjauan manusia.",
    status: "Dalam pengembangan",
    introduction:
      "Fondasi SerenTax sedang dibangun. Halaman ini adalah pratinjau awal; layanan transaksi belum tersedia.",
    roadmapTitle: "Dirancang untuk alur kerja Anda",
    intakeTitle: "Siapkan data",
    intakeBody:
      "Rencana: input manual dan impor spreadsheet, dengan OCR opsional.",
    reviewTitle: "Tinjau bersama",
    reviewBody: "Rencana: pemeriksaan dan persetujuan manusia sebelum ekspor.",
    exportTitle: "Ekspor dengan bukti",
    exportBody:
      "Rencana: XML dari templat DJP terverifikasi untuk impor manual ke Coretax.",
    pending: "Belum tersedia",
    trialTitle: "Uji coba yang direncanakan",
    trialBody:
      "72 jam setelah aktivasi akun terverifikasi. Maksimal 1 transaksi per hari kalender Asia/Jakarta dan 3 transaksi selama uji coba, di seluruh organisasi. Aktivasi tersedia di halaman akun; pembuatan transaksi belum tersedia.",
    billing:
      "Harga paket akan mengikuti katalog Berlanggan yang terverifikasi. Langganan belum tersedia.",
    disclaimer:
      "SerenTax bukan DJP, PJAP, atau penasihat pajak tersertifikasi. Tidak ada pengiriman otomatis ke Coretax. Validasi ahli pajak dan templat resmi diperlukan sebelum fitur pajak dirilis.",
    language: "Pilih bahasa",
    skip: "Lewati ke konten",
    loading: "Memuat halaman…",
    error: "Halaman tidak dapat dimuat.",
    retry: "Coba lagi",
    missing: "Halaman tidak ditemukan.",
    home: "Kembali ke beranda",
  },
  en: {
    title: "Tax preparation, thoughtfully organized.",
    description:
      "A workspace to help accounting teams prepare and review Indonesian tax documents.",
    eyebrow: "Organized documents. Human review.",
    status: "In development",
    introduction:
      "The SerenTax foundation is being built. This is an early preview; transaction services are not yet available.",
    roadmapTitle: "Designed around your workflow",
    intakeTitle: "Prepare your data",
    intakeBody:
      "Planned: manual entry and spreadsheet imports, with optional OCR.",
    reviewTitle: "Review together",
    reviewBody: "Planned: human verification and approval before export.",
    exportTitle: "Export with evidence",
    exportBody:
      "Planned: XML from verified DJP templates for manual import into Coretax.",
    pending: "Not yet available",
    trialTitle: "Planned trial",
    trialBody:
      "72 hours from verified account activation. At most 1 transaction per Asia/Jakarta calendar day and 3 during the entire trial, across organizations. Activation is available on the account page; transaction creation is not yet available.",
    billing:
      "Plan prices will follow the verified Berlanggan catalog. Subscriptions are not yet available.",
    disclaimer:
      "SerenTax is not DJP, a PJAP, or a certified tax adviser. There is no automatic Coretax submission. Tax expert validation and official templates are required before tax features launch.",
    language: "Choose language",
    skip: "Skip to content",
    loading: "Loading page…",
    error: "This page could not be loaded.",
    retry: "Try again",
    missing: "Page not found.",
    home: "Return home",
  },
} satisfies Record<Locale, Record<string, string>>;
