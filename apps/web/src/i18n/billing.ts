import type { Locale } from "./messages";
import type { BillingAdapterMode, LicenseStatus } from "../lib/billing/schemas";

export const billingMessages = {
  id: {
    orgTitle: "Langganan & lisensi",
    page: {
      subtitle:
        "Paket langganan ruang kerja ini, kuota yang dipakai, dan kunci lisensi.",
      statePaid: "Langganan aktif",
      statePaidBody:
        "Transaksi baru memakai kuota bulanan paket Anda. Kuota direset setiap awal bulan (WIB).",
      stateTrial: "Masa uji coba",
      stateTrialBody:
        "Anda sedang memakai uji coba akun. Setelah uji coba habis, aktifkan paket berlangganan untuk terus membuat transaksi baru.",
      stateNone: "Belum berlangganan",
      stateNoneBody:
        "Ruang kerja ini belum punya paket aktif. Aktifkan uji coba atau masukkan kunci lisensi setelah membeli paket.",
      stateAttention: "Langganan perlu perhatian",
      stateAttentionBody:
        "Lisensi tidak aktif. Data tetap bisa dibaca, tetapi transaksi baru diblokir sampai lisensi dipulihkan.",
      plan: "Paket",
      noPlan: "Belum ada paket",
      buyPlan: "Beli / perpanjang paket",
      enterKey: "Masukkan kunci lisensi",
      purchaseClosed: "Pembelian paket belum dibuka.",
      paidClosedTitle: "Paket berbayar belum tersedia",
      paidClosedBody:
        "Paket berbayar belum dibuka sampai penyedia lisensi (Berlanggan) mengonfirmasi dukungan untuk layanan online. Selama itu Anda tetap bisa memakai uji coba akun.",
      testModeTitle: "Mode uji",
      testModeBody:
        "Lisensi pada lingkungan ini adalah data uji dan tidak berlaku untuk penggunaan produksi.",
      tabs: {
        overview: "Ringkasan",
        plan: "Paket & hak",
        trial: "Uji coba",
        license: "Kunci lisensi",
      },
      usageTitle: "Pemakaian bulan ini",
      usageIntro:
        "Angka dihitung per bulan kalender Asia/Jakarta. Batas mengikuti paket aktif.",
      used: "Terpakai",
      limit: "Batas",
      of: "dari",
      noLimit: "Tanpa batas paket",
      remaining: "Sisa",
      benefitsTitle: "Hak paket Anda",
      benefitsIntro:
        "Hak ini dibaca dari lisensi resmi yang ditandatangani penyedia; SerenTax tidak mengubahnya.",
      benefit: "Hak",
      value: "Nilai",
      yes: "Ya",
      no: "Tidak",
      noBenefits:
        "Belum ada hak paket karena belum ada lisensi berbayar yang aktif.",
      catalogTitle: "Paket yang tersedia",
      price: "Harga",
      period: "Periode",
      trialIntro:
        "Uji coba berlaku per akun (bukan per ruang kerja) dan hanya bisa diaktifkan sekali.",
      trialRulesTitle: "Aturan uji coba",
      trialRules:
        "72 jam sejak diaktifkan · maksimal 1 transaksi baru per hari (WIB) · maksimal 3 transaksi selama uji coba · membatalkan transaksi tidak mengembalikan kuota.",
      stepsTitle: "Cara mengaktifkan paket",
      step1: "Beli paket di toko resmi Berlanggan.",
      step2: "Salin kunci lisensi dari email pembelian.",
      step3: "Tempel kunci di kolom kunci lisensi, lalu klik Aktifkan lisensi.",
      currentLicense: "Lisensi saat ini",
      noLicense:
        "Belum ada kunci lisensi yang tersimpan untuk ruang kerja ini.",
      keyHint: "Kunci (disamarkan)",
      validUntil: "Berlaku hingga",
      lastChecked: "Terakhir dicek",
      lastProblem: "Masalah terakhir",
      advanced: "Pengaturan lanjutan",
      technical: "Detail teknis (untuk admin / dukungan)",
      billingMode: "Mode penagihan",
      providerApproval: "Persetujuan penyedia",
      approved: "Disetujui",
      pending: "Belum disetujui",
      notes: "Catatan",
      deactivateConfirm:
        "Nonaktifkan lisensi ini? Transaksi baru akan diblokir sampai lisensi diaktifkan lagi.",
    },
    orgIntro:
      "Integrasi Berlanggan berada di balik gerbang kompatibilitas. Dokumentasi Berlanggan menjelaskan model lisensi on-premise berbasis device fingerprint/seat, sehingga akses berbayar SaaS produksi tetap dinonaktifkan sampai penyedia menyetujui semantik multi-tenant yang di-host di server.",
    gateWarningTitle: "Status Gerbang Kompatibilitas Berlanggan",
    gateBlockedBanner:
      "Paket berbayar belum tersedia: akses paket berbayar SaaS produksi dinonaktifkan. Uji coba akun tetap mengikuti batas lokal 72 jam, maksimum 1 transaksi per hari Jakarta, dan 3 transaksi total lintas ruang kerja.",
    gateLiveBanner:
      "Integrasi Berlanggan aktif dan semantik lisensi SaaS telah dikonfirmasi penyedia.",
    gateSyntheticBanner:
      "Mode uji sintetis aktif hanya untuk pengujian terisolasi — tidak mengaktifkan akses berbayar produksi.",
    trialSectionTitle: "Kuota Uji Coba Lokal (Tetap Berlaku)",
    trialSummary:
      "Uji coba per akun tetap 72 jam, maksimum 1 transaksi baru per hari Asia/Jakarta, dan total 3 transaksi lintas organisasi.",
    licenseSectionTitle: "Status Lisensi & Entitlement Workspace",
    entitlementsTitle: "Entitlement & Penggunaan Terpusat",
    noEntitlements:
      "Belum ada entitlement berbayar yang aktif. Nilai hanya dibaca dari respons tertanda tangan Berlanggan setelah disetujui.",
    storefrontLinkLabel: "Buka storefront penjual terverifikasi (Berlanggan)",
    noStorefrontNotice:
      "Tautan pembelian eksternal belum tersedia sampai integrasi dan lisensi SaaS diverifikasi.",
    activateTitle: "Aktivasi / Kelola Kunci Lisensi (Pemilik / Admin)",
    licenseKeyLabel: "Kunci lisensi Berlanggan (disimpan terenkripsi)",
    fingerprintLabel: "Fingerprint instans/tenant (opsional)",
    activateButton: "Aktifkan lisensi",
    validateButton: "Validasi ulang",
    deactivateButton: "Nonaktifkan",
    savedOk: "Status lisensi workspace diperbarui.",
    ownerOnlyNotice:
      "Hanya Pemilik atau Admin ruang kerja yang dapat mengaktifkan, memvalidasi, atau mencabut kunci lisensi.",
    usageLabels: {
      companies: "Perusahaan aktif",
      members: "Anggota workspace",
      monthTransactions: "Transaksi bulan ini",
      monthExports: "Ekspor XML bulan ini",
    },
    statuses: {
      NOT_CONFIGURED: "Belum dikonfigurasi",
      ACTIVE: "Aktif (terverifikasi)",
      GRACE: "Masa tenggang",
      EXPIRED: "Kedaluwarsa",
      SUSPENDED: "Ditangguhkan",
      REVOKED: "Dicabut",
      INVALID: "Tidak valid (tanda tangan ditolak)",
      SEAT_FULL: "Kuota perangkat penuh",
      RATE_LIMITED: "Batas permintaan tercapai",
      COMPATIBILITY_BLOCKED: "Diblokir (menunggu persetujuan penyedia)",
    } satisfies Record<LicenseStatus, string>,
    modes: {
      NOT_CONFIGURED: "Tidak aktif (bawaan aman)",
      SYNTHETIC_TEST: "Uji sintetis lokal",
      BERLANGGAN_LIVE: "Berlanggan (produksi)",
    } satisfies Record<BillingAdapterMode, string>,
    adminTitle: "Konfigurasi Billing Berlanggan (Superadmin)",
    adminIntro:
      "Kelola adaptor HTTP Berlanggan, nama variabel env rahasia (product/webhook secret), kunci publik Ed25519 untuk verifikasi Canonical JSON, dan persetujuan kompatibilitas lisensi SaaS.",
    adapterModeLabel: "Mode adaptor",
    apiBaseUrlLabel: "URL dasar API Berlanggan (HTTPS)",
    productSlugLabel: "Slug produk penjual Berlanggan",
    storefrontUrlLabel: "URL storefront eksternal terverifikasi (HTTPS)",
    productSecretRefLabel: "Nama env var secret produk (server-only)",
    webhookSecretRefLabel: "Nama env var secret webhook HMAC (server-only)",
    ed25519KeyLabel: "Kunci publik Ed25519 (PEM / hex 32-byte)",
    saasApprovedLabel:
      "Penyedia Berlanggan telah menyetujui semantik lisensi SaaS multi-tenant (wajib false sampai disetujui)",
    compatibilityNoteLabel: "Catatan bukti kompatibilitas",
    saveConfigButton: "Simpan konfigurasi billing",
    fetchCatalogButton: "Ambil katalog paket",
    webhookHealthTitle: "Kesehatan Webhook Berlanggan",
    configSavedOk: "Konfigurasi billing disimpan.",
    catalogFetchedOk: "Katalog paket berhasil diperbarui dari penyedia.",
    errors: {
      BILLING_NOT_CONFIGURED: "Penagihan belum dikonfigurasi.",
      SAAS_LICENSING_UNAPPROVED:
        "Akses lisensi SaaS diblokir sampai Berlanggan menyetujui semantik multi-tenant server-hosted.",
      INVALID_WEBHOOK_SIGNATURE:
        "Tanda tangan webhook X-Berlanggan-Signature tidak valid.",
      ENTITLEMENT_SIGNATURE_INVALID:
        "Verifikasi tanda tangan Ed25519 atas Canonical JSON entitlement gagal.",
      NOT_FOUND: "Belum ada kunci lisensi tersimpan untuk workspace ini.",
      INVALID_CONFIGURATION:
        "Mode Berlanggan (produksi) memerlukan apiBaseUrl dan productSlug yang valid.",
      SEAT_FULL:
        "Batas seat perangkat/lisensi di Berlanggan penuh (seat_full).",
      RATE_LIMITED: "Permintaan ke API Berlanggan terkena batas laju.",
      PROVIDER_UNAVAILABLE:
        "API Berlanggan tidak dapat dijangkau atau menolak permintaan.",
      INVALID_PROVIDER_RESPONSE:
        "Respons API Berlanggan tidak sesuai skema yang diharapkan.",
      PROVIDER_SECRET_MISSING:
        "Variabel env webhook/product secret server belum disetel.",
      FORBIDDEN: "Akses ditolak.",
    },
  },
  en: {
    orgTitle: "Subscription & license",
    page: {
      subtitle:
        "This workspace's subscription plan, quota usage and license key.",
      statePaid: "Subscription active",
      statePaidBody:
        "New transactions use your plan's monthly quota. Quota resets at the start of every month (WIB).",
      stateTrial: "Trial period",
      stateTrialBody:
        "You are using the account trial. When it ends, activate a subscription to keep creating new transactions.",
      stateNone: "No subscription yet",
      stateNoneBody:
        "This workspace has no active plan. Activate the trial, or enter a license key after buying a plan.",
      stateAttention: "Subscription needs attention",
      stateAttentionBody:
        "The license is not active. Data stays readable, but new transactions are blocked until the license is restored.",
      plan: "Plan",
      noPlan: "No plan yet",
      buyPlan: "Buy / renew a plan",
      enterKey: "Enter license key",
      purchaseClosed: "Plan purchases are not open yet.",
      paidClosedTitle: "Paid plans are not available yet",
      paidClosedBody:
        "Paid plans stay closed until the licensing provider (Berlanggan) confirms support for online services. Meanwhile you can keep using the account trial.",
      testModeTitle: "Test mode",
      testModeBody:
        "Licenses in this environment are test data and are not valid for production use.",
      tabs: {
        overview: "Overview",
        plan: "Plan & benefits",
        trial: "Trial",
        license: "License key",
      },
      usageTitle: "Usage this month",
      usageIntro:
        "Counted per Asia/Jakarta calendar month. Limits follow the active plan.",
      used: "Used",
      limit: "Limit",
      of: "of",
      noLimit: "No plan limit",
      remaining: "Remaining",
      benefitsTitle: "Your plan benefits",
      benefitsIntro:
        "Benefits are read from the provider's signed license; SerenTax never changes them.",
      benefit: "Benefit",
      value: "Value",
      yes: "Yes",
      no: "No",
      noBenefits:
        "No plan benefits yet because there is no active paid license.",
      catalogTitle: "Available plans",
      price: "Price",
      period: "Period",
      trialIntro:
        "The trial is per account (not per workspace) and can be activated only once.",
      trialRulesTitle: "Trial rules",
      trialRules:
        "72 hours from activation · at most 1 new transaction per day (WIB) · at most 3 transactions during the trial · voiding does not restore quota.",
      stepsTitle: "How to activate a plan",
      step1: "Buy a plan in the official Berlanggan store.",
      step2: "Copy the license key from the purchase email.",
      step3:
        "Paste the key into the license key field and click Activate license.",
      currentLicense: "Current license",
      noLicense: "No license key is stored for this workspace yet.",
      keyHint: "Key (masked)",
      validUntil: "Valid until",
      lastChecked: "Last checked",
      lastProblem: "Last problem",
      advanced: "Advanced settings",
      technical: "Technical details (for admins / support)",
      billingMode: "Billing mode",
      providerApproval: "Provider approval",
      approved: "Approved",
      pending: "Not approved yet",
      notes: "Notes",
      deactivateConfirm:
        "Deactivate this license? New transactions will be blocked until it is activated again.",
    },
    orgIntro:
      "Berlanggan integration sits behind an explicit compatibility gate. Berlanggan documentation describes an on-premise device fingerprint/seat model, so production SaaS paid access stays disabled until the provider confirms server-hosted multi-tenant licensing semantics.",
    gateWarningTitle: "Berlanggan Compatibility Gate Status",
    gateBlockedBanner:
      "Paid plans are not available yet: production SaaS paid plans are disabled. Account trial continues with local rules: 72 hours, at most 1 transaction per Jakarta calendar day, and 3 transactions total across workspaces.",
    gateLiveBanner:
      "Berlanggan integration is live and provider SaaS tenant licensing semantics are approved.",
    gateSyntheticBanner:
      "Synthetic test mode is active strictly for isolated testing — never grants production paid access.",
    trialSectionTitle: "Local Trial Allowance (Always Enforced)",
    trialSummary:
      "Account trials remain fixed at 72 hours, maximum 1 new transaction per Asia/Jakarta day, and 3 transactions total across workspaces.",
    licenseSectionTitle: "Workspace License & Entitlement Status",
    entitlementsTitle: "Centralized Entitlements & Usage",
    noEntitlements:
      "No active paid entitlements. Values are read exclusively from cryptographically signed Berlanggan responses after approval.",
    storefrontLinkLabel: "Open verified seller storefront (Berlanggan)",
    noStorefrontNotice:
      "No external purchase link is published until catalog integration and SaaS licensing are verified.",
    activateTitle: "Activate / Manage License Key (Owner / Admin)",
    licenseKeyLabel: "Berlanggan license key (stored encrypted)",
    fingerprintLabel: "Instance/tenant fingerprint (optional)",
    activateButton: "Activate license",
    validateButton: "Re-validate",
    deactivateButton: "Deactivate",
    savedOk: "Workspace license state updated.",
    ownerOnlyNotice:
      "Only workspace Owners or Admins may activate, validate, or deactivate license keys.",
    usageLabels: {
      companies: "Active companies",
      members: "Workspace members",
      monthTransactions: "Transactions this month",
      monthExports: "XML exports this month",
    },
    statuses: {
      NOT_CONFIGURED: "Not configured",
      ACTIVE: "Active (verified)",
      GRACE: "Grace period",
      EXPIRED: "Expired",
      SUSPENDED: "Suspended",
      REVOKED: "Revoked",
      INVALID: "Invalid (signature rejected)",
      SEAT_FULL: "Device quota full",
      RATE_LIMITED: "Rate limit reached",
      COMPATIBILITY_BLOCKED: "Blocked (awaiting provider approval)",
    } satisfies Record<LicenseStatus, string>,
    modes: {
      NOT_CONFIGURED: "Off (safe default)",
      SYNTHETIC_TEST: "Local synthetic test",
      BERLANGGAN_LIVE: "Berlanggan (production)",
    } satisfies Record<BillingAdapterMode, string>,
    adminTitle: "Berlanggan Billing Configuration (Superadmin)",
    adminIntro:
      "Configure the Berlanggan HTTP adapter, server-only secret env var names, Ed25519 public key for Canonical JSON verification, and the SaaS licensing compatibility gate.",
    adapterModeLabel: "Adapter mode",
    apiBaseUrlLabel: "Berlanggan API base URL (HTTPS)",
    productSlugLabel: "Berlanggan seller product slug",
    storefrontUrlLabel: "Verified external storefront URL (HTTPS)",
    productSecretRefLabel: "Product secret env var name (server-only)",
    webhookSecretRefLabel: "Webhook HMAC secret env var name (server-only)",
    ed25519KeyLabel: "Ed25519 public key (PEM / 32-byte hex)",
    saasApprovedLabel:
      "Provider approved server-hosted multi-tenant SaaS licensing semantics (must remain unchecked until approved)",
    compatibilityNoteLabel: "Compatibility verification notes",
    saveConfigButton: "Save billing configuration",
    fetchCatalogButton: "Fetch plans catalog",
    webhookHealthTitle: "Berlanggan Webhook Health",
    configSavedOk: "Billing configuration saved.",
    catalogFetchedOk: "Catalog plans refreshed from provider.",
    errors: {
      BILLING_NOT_CONFIGURED: "Billing is not configured.",
      SAAS_LICENSING_UNAPPROVED:
        "SaaS licensing stays blocked until Berlanggan approves server-hosted multi-tenant semantics.",
      INVALID_WEBHOOK_SIGNATURE:
        "Webhook X-Berlanggan-Signature verification failed.",
      ENTITLEMENT_SIGNATURE_INVALID:
        "Ed25519 signature verification failed over Canonical JSON entitlement.",
      NOT_FOUND: "No stored license key exists for this workspace.",
      INVALID_CONFIGURATION:
        "Berlanggan (production) mode requires a valid API URL and product code.",
      SEAT_FULL: "Berlanggan license seat quota is full (seat_full).",
      RATE_LIMITED: "Provider rate limit exceeded.",
      PROVIDER_UNAVAILABLE:
        "Berlanggan API was unreachable or rejected the request.",
      INVALID_PROVIDER_RESPONSE:
        "Berlanggan API response did not match the verified schema.",
      PROVIDER_SECRET_MISSING:
        "Server secret env variable referenced by product/webhook config is missing.",
      FORBIDDEN: "Access denied.",
    },
  },
} satisfies Record<Locale, object>;
