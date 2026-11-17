import type { Locale } from "./messages";
import type { BillingAdapterMode, LicenseStatus } from "../lib/billing/schemas";

export const billingMessages = {
  id: {
    orgTitle: "Langganan & Lisensi Workspace",
    orgIntro:
      "Integrasi Berlanggan berada di balik gerbang kompatibilitas. Dokumentasi Berlanggan menjelaskan model lisensi on-premise berbasis device fingerprint/seat, sehingga akses berbayar SaaS produksi tetap dinonaktifkan sampai penyedia menyetujui semantik multi-tenant yang di-host di server.",
    gateWarningTitle: "Status Gerbang Kompatibilitas Berlanggan",
    gateBlockedBanner:
      "BILLING_NOT_CONFIGURED / SAAS_LICENSING_PENDING: Akses paket berbayar SaaS produksi dinonaktifkan. Uji coba akun tetap mengikuti batas lokal 72 jam, maksimum 1 transaksi per hari Jakarta, dan 3 transaksi total lintas ruang kerja.",
    gateLiveBanner:
      "BERLANGGAN_LIVE terkonfigurasi dan semantik lisensi SaaS telah dikonfirmasi penyedia.",
    gateSyntheticBanner:
      "Mode SYNTHETIC_TEST aktif hanya untuk pengujian terisolasi — tidak mengaktifkan akses berbayar produksi.",
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
    activateTitle: "Aktivasi / Kelola Kunci Lisensi (OWNER / ADMIN)",
    licenseKeyLabel: "Kunci lisensi Berlanggan (disimpan terenkripsi)",
    fingerprintLabel: "Fingerprint instans/tenant (opsional)",
    activateButton: "Aktifkan lisensi",
    validateButton: "Validasi ulang (/v1/validate)",
    deactivateButton: "Nonaktifkan (/v1/deactivate)",
    savedOk: "Status lisensi workspace diperbarui.",
    ownerOnlyNotice:
      "Hanya OWNER atau ADMIN workspace yang dapat mengaktifkan, memvalidasi, atau mencabut kunci lisensi.",
    usageLabels: {
      companies: "Perusahaan aktif",
      members: "Anggota workspace",
      monthTransactions: "Transaksi bulan ini",
      monthExports: "Ekspor XML bulan ini",
    },
    statuses: {
      NOT_CONFIGURED: "NOT_CONFIGURED (belum dikonfigurasi)",
      ACTIVE: "ACTIVE (aktif terverifikasi Ed25519)",
      GRACE: "GRACE (masa tenggang terverifikasi)",
      EXPIRED: "EXPIRED (kedaluwarsa)",
      SUSPENDED: "SUSPENDED (ditangguhkan)",
      REVOKED: "REVOKED (dicabut)",
      INVALID: "INVALID (tidak valid / tanda tangan ditolak)",
      SEAT_FULL: "SEAT_FULL (batas seat penuh)",
      RATE_LIMITED: "RATE_LIMITED (batas laju tercapai)",
      COMPATIBILITY_BLOCKED:
        "COMPATIBILITY_BLOCKED (menunggu konfirmasi SaaS penyedia)",
    } satisfies Record<LicenseStatus, string>,
    modes: {
      NOT_CONFIGURED: "NOT_CONFIGURED (bawaan fail-closed)",
      SYNTHETIC_TEST: "SYNTHETIC_TEST (test double lokal)",
      BERLANGGAN_LIVE: "BERLANGGAN_LIVE (adaptor HTTP Berlanggan)",
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
    fetchCatalogButton:
      "Ambil katalog paket (/v1/catalog/products/{slug}/plans)",
    webhookHealthTitle: "Kesehatan Webhook Berlanggan",
    configSavedOk: "Konfigurasi billing disimpan.",
    catalogFetchedOk: "Katalog paket berhasil diperbarui dari penyedia.",
    errors: {
      BILLING_NOT_CONFIGURED:
        "BILLING_NOT_CONFIGURED: Adaptor billing belum dikonfigurasi.",
      SAAS_LICENSING_UNAPPROVED:
        "SAAS_LICENSING_UNAPPROVED: Akses lisensi SaaS diblokir sampai Berlanggan menyetujui semantik multi-tenant server-hosted.",
      INVALID_WEBHOOK_SIGNATURE:
        "Tanda tangan webhook X-Berlanggan-Signature tidak valid.",
      ENTITLEMENT_SIGNATURE_INVALID:
        "Verifikasi tanda tangan Ed25519 atas Canonical JSON entitlement gagal.",
      NOT_FOUND: "Belum ada kunci lisensi tersimpan untuk workspace ini.",
      INVALID_CONFIGURATION:
        "Konfigurasi mode BERLANGGAN_LIVE memerlukan apiBaseUrl dan productSlug yang valid.",
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
    orgTitle: "Workspace Subscription & Licensing",
    orgIntro:
      "Berlanggan integration sits behind an explicit compatibility gate. Berlanggan documentation describes an on-premise device fingerprint/seat model, so production SaaS paid access stays disabled until the provider confirms server-hosted multi-tenant licensing semantics.",
    gateWarningTitle: "Berlanggan Compatibility Gate Status",
    gateBlockedBanner:
      "BILLING_NOT_CONFIGURED / SAAS_LICENSING_PENDING: Production SaaS paid plans are disabled. Account trial continues with local rules: 72 hours, at most 1 transaction per Jakarta calendar day, and 3 transactions total across workspaces.",
    gateLiveBanner:
      "BERLANGGAN_LIVE is configured and provider SaaS tenant licensing semantics are approved.",
    gateSyntheticBanner:
      "SYNTHETIC_TEST mode is active strictly for isolated testing — never grants production paid access.",
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
    activateTitle: "Activate / Manage License Key (OWNER / ADMIN)",
    licenseKeyLabel: "Berlanggan license key (stored encrypted)",
    fingerprintLabel: "Instance/tenant fingerprint (optional)",
    activateButton: "Activate license",
    validateButton: "Re-validate (/v1/validate)",
    deactivateButton: "Deactivate (/v1/deactivate)",
    savedOk: "Workspace license state updated.",
    ownerOnlyNotice:
      "Only workspace OWNER or ADMIN members may activate, validate, or deactivate license keys.",
    usageLabels: {
      companies: "Active companies",
      members: "Workspace members",
      monthTransactions: "Transactions this month",
      monthExports: "XML exports this month",
    },
    statuses: {
      NOT_CONFIGURED: "NOT_CONFIGURED",
      ACTIVE: "ACTIVE (Ed25519 verified)",
      GRACE: "GRACE (verified grace period)",
      EXPIRED: "EXPIRED",
      SUSPENDED: "SUSPENDED",
      REVOKED: "REVOKED",
      INVALID: "INVALID (signature or key rejected)",
      SEAT_FULL: "SEAT_FULL",
      RATE_LIMITED: "RATE_LIMITED",
      COMPATIBILITY_BLOCKED:
        "COMPATIBILITY_BLOCKED (awaiting provider SaaS approval)",
    } satisfies Record<LicenseStatus, string>,
    modes: {
      NOT_CONFIGURED: "NOT_CONFIGURED (fail-closed default)",
      SYNTHETIC_TEST: "SYNTHETIC_TEST (local test double)",
      BERLANGGAN_LIVE: "BERLANGGAN_LIVE (Berlanggan HTTP adapter)",
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
    fetchCatalogButton:
      "Fetch plans catalog (/v1/catalog/products/{slug}/plans)",
    webhookHealthTitle: "Berlanggan Webhook Health",
    configSavedOk: "Billing configuration saved.",
    catalogFetchedOk: "Catalog plans refreshed from provider.",
    errors: {
      BILLING_NOT_CONFIGURED:
        "BILLING_NOT_CONFIGURED: Billing adapter is not configured.",
      SAAS_LICENSING_UNAPPROVED:
        "SAAS_LICENSING_UNAPPROVED: SaaS licensing stays blocked until Berlanggan approves server-hosted multi-tenant semantics.",
      INVALID_WEBHOOK_SIGNATURE:
        "Webhook X-Berlanggan-Signature verification failed.",
      ENTITLEMENT_SIGNATURE_INVALID:
        "Ed25519 signature verification failed over Canonical JSON entitlement.",
      NOT_FOUND: "No stored license key exists for this workspace.",
      INVALID_CONFIGURATION:
        "BERLANGGAN_LIVE requires valid apiBaseUrl and productSlug values.",
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
