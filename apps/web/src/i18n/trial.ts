import type { Locale } from "./messages";
export function formatTrialTimestamp(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}
export const trialMessages = {
  id: {
    title: "Uji coba akun",
    activate: "Aktifkan uji coba 72 jam",
    consent:
      "Aktivasi hanya sekali. Waktu mulai berjalan sekarang dan tidak dapat diulang. Batas berlaku untuk akun ini di seluruh ruang kerja.",
    NOT_ACTIVATED: "Uji coba belum diaktifkan.",
    ACTIVE: "Uji coba aktif.",
    DAILY_LIMIT: "Kuota hari ini sudah digunakan.",
    TOTAL_LIMIT: "Seluruh kuota uji coba sudah digunakan.",
    EXPIRED: "Uji coba telah berakhir.",
    remaining: "Sisa waktu",
    today: "Transaksi tersedia hari ini",
    total: "Sisa kuota keseluruhan",
    expiry: "Berakhir",
    next: "Jendela berikutnya",
    loading: "Memuat status uji coba…",
    busy: "Mengaktifkan…",
    retry: "Muat ulang status",
    error: "Status uji coba tidak dapat dimuat. Coba lagi.",
    limits:
      "Maksimal 1 transaksi per hari kalender Jakarta dan 3 selama uji coba. Hapus, edit, dan ulangi permintaan tidak mengembalikan kuota.",
    unavailable:
      "Draf transaksi manual dan impor tersedia untuk peran Penyusun. Evaluasi pajak memerlukan aturan pajak yang disetujui, dan ekspor XML baru tersedia untuk keluarga BPPU yang terverifikasi.",
    billing:
      "Paket berbayar mengikuti katalog Berlanggan yang terverifikasi dan aktif setelah lisensi ruang kerja divalidasi.",
    subscriptionTitle: "Kuota langganan",
    subscriptionActive: "Langganan aktif",
    subscriptionPlan: "Paket",
    subscriptionUsed: "Transaksi bulan ini",
    subscriptionRemaining: "Sisa kuota bulan ini",
    subscriptionUnlimited: "Tanpa batas",
    subscriptionNote:
      "Transaksi baru di ruang kerja ini memakai kuota bulanan langganan (bulan kalender Asia/Jakarta), bukan kuota uji coba. Membatalkan transaksi tidak mengembalikan kuota.",
    readOnly:
      "Catatan tetap dapat dibaca sesuai hak akses. Transaksi baru yang memerlukan trial aktif ditolak.",
    IDEMPOTENCY_CONFLICT:
      "Kunci permintaan sudah dipakai untuk data atau ruang kerja berbeda.",
  },
  en: {
    title: "Account trial",
    activate: "Activate 72-hour trial",
    consent:
      "Activation is once only. Time starts now and cannot be restarted. Limits apply to this account across all workspaces.",
    NOT_ACTIVATED: "Trial not activated.",
    ACTIVE: "Trial active.",
    DAILY_LIMIT: "Today’s allowance has been used.",
    TOTAL_LIMIT: "All trial allowance has been used.",
    EXPIRED: "Trial expired.",
    remaining: "Time remaining",
    today: "Transactions available today",
    total: "Total allowance remaining",
    expiry: "Expires",
    next: "Next daily window",
    loading: "Loading trial status…",
    busy: "Activating…",
    retry: "Reload status",
    error: "Trial status could not be loaded. Try again.",
    limits:
      "At most 1 transaction per Jakarta calendar day and 3 during the trial. Deletion, editing and retries do not restore allowance.",
    unavailable:
      "Manual drafts and imports are available for the Preparer role. Tax evaluation requires approved tax rules, and XML export is currently available for the verified BPPU family only.",
    billing:
      "Paid plans follow the verified Berlanggan catalog and activate once the workspace license is validated.",
    subscriptionTitle: "Subscription quota",
    subscriptionActive: "Subscription active",
    subscriptionPlan: "Plan",
    subscriptionUsed: "Transactions this month",
    subscriptionRemaining: "Remaining this month",
    subscriptionUnlimited: "Unlimited",
    subscriptionNote:
      "New transactions in this workspace use the subscription's monthly quota (Asia/Jakarta calendar month), not the trial allowance. Voiding a transaction does not restore quota.",
    readOnly:
      "Records remain readable according to your access rights. New transactions requiring an active trial are blocked.",
    IDEMPOTENCY_CONFLICT:
      "This request key was already used for different data or another workspace.",
  },
} satisfies Record<Locale, Record<string, string>>;
