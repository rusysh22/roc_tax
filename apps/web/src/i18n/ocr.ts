import type { Locale } from "./messages";
import type { OcrAdapterKey, OcrJobStatus } from "../lib/intake/ocr";

export const ocrMessages = {
  id: {
    settingsLink: "Pengaturan OCR",
    settingsTitle: "Konfigurasi OCR ruang kerja",
    settingsIntro:
      "Secara bawaan OCR diatur ke NONE (input manual & spreadsheet). Pemilik atau Admin dapat memilih penyedia yang telah disetujui platform beserta persetujuan pemrosesan data.",
    productionBoundary:
      "OCR AI eksternal produksi berstatus NOT_CONFIGURED sampai penyedia disetujui dan kredensial server disiapkan. Dokumen tidak pernah dikirim ke layanan AI eksternal tanpa persetujuan penyedia dan persetujuan tenant.",
    effectiveStatus: "Status efektif OCR",
    effectiveStatuses: {
      NONE_MANUAL: "NONE · Input manual & spreadsheet saja",
      READY: "Siap (mode terkonfigurasi)",
      NOT_CONFIGURED: "NOT_CONFIGURED · Penyedia/kredensial belum siap",
      CONSENT_REQUIRED: "Menunggu persetujuan pemrosesan AI tenant",
      VENDOR_NOT_APPROVED: "Diblokir · Vendor belum disetujui",
    },
    chooseProvider: "Penyedia OCR yang diizinkan",
    noneOption: "NONE · Nonaktifkan AI OCR (manual saja)",
    consentLabel:
      "Saya memahami dan menyetujui pemrosesan dokumen sumber ruang kerja ini melalui penyedia/wilayah yang dipilih sesuai kebijakan retensi tercantum.",
    saveSettings: "Simpan pengaturan OCR",
    managerOnly:
      "Hanya Pemilik atau Admin yang dapat mengubah pengaturan penyedia OCR ruang kerja.",
    monthlyUsage: "Pemakaian bulan ini (Asia/Jakarta)",
    pagesUsed: "Halaman diproses",
    spendUsed: "Estimasi biaya",
    jobsCount: "Total pekerjaan",
    modelLabel: "Model",
    regionLabel: "Wilayah",
    retentionLabel: "Retensi",
    capLabel: "Batas bulanan",
    adminTitle: "Registri penyedia OCR platform (Superadmin)",
    adminIntro:
      "Kelola adaptor OCR yang tersedia untuk tenant, referensi rahasia server (env var), batas halaman/biaya, wilayah, dan status persetujuan vendor. Rahasia API tidak pernah disimpan di database atau dikirim ke browser.",
    forbiddenAdmin: "Akses ditolak. Halaman ini khusus Superadmin platform.",
    jobHealthTitle: "Ringkasan kesehatan pekerjaan OCR (agregat)",
    upsertProvider: "Simpan penyedia OCR",
    slugLabel: "Slug penyedia (huruf kecil/angka/tanda hubung)",
    displayNameLabel: "Nama tampilan",
    adapterKeyLabel: "Adaptor",
    adapterKeys: {
      NONE: "NONE (Manual saja)",
      SYNTHETIC_TEST: "SYNTHETIC_TEST (Uji lokal tanpa jaringan)",
      EXTERNAL_NOT_CONFIGURED: "EXTERNAL_NOT_CONFIGURED (Eksternal belum siap)",
    } satisfies Record<OcrAdapterKey, string>,
    endpointUrlLabel: "URL endpoint HTTPS (opsional, dicek SSRF)",
    secretRefLabel: "Nama env var rahasia server (opsional, mis. OCR_API_KEY)",
    maxPagesLabel: "Maks halaman per dokumen",
    timeoutMsLabel: "Batas waktu (ms)",
    monthlyPageCapLabel: "Batas halaman bulanan per tenant",
    monthlySpendCapLabel: "Batas biaya bulanan per tenant (IDR)",
    costPerPageLabel: "Estimasi biaya per halaman (IDR)",
    retentionPolicyLabel: "Kebijakan retensi",
    processorNoticeLabel: "Pemberitahuan pemroses / dasar pemrosesan",
    vendorApprovedLabel: "Vendor telah disetujui untuk pemrosesan dokumen",
    enabledLabel: "Aktifkan penyedia ini untuk dipilih tenant",
    secretReady: "Env rahasia tersedia",
    secretMissing: "Env rahasia belum disetel",
    noSecretNeeded: "Tidak memakai rahasia eksternal",
    transactionOcrTitle: "Ekstraksi kandidat OCR & koreksi berdampingan",
    transactionOcrNotice:
      "OCR hanya menghasilkan kandidat field sementara. AI tidak pernah memilih klasifikasi atau tarif pajak final; peninjauan manusia wajib sebelum menerapkan nilai.",
    runOcr: "Jalankan OCR pada dokumen ini",
    noDocumentsForOcr:
      "Unggah dokumen sumber PDF/JPG/PNG terlebih dahulu untuk menjalankan ekstraksi OCR.",
    manualFallbackButton: "Kembali ke input manual",
    retryJobButton: "Coba ulang pekerjaan dead-letter",
    jobsTitle: "Status pekerjaan OCR",
    jobStatuses: {
      QUEUED: "Dalam antrean",
      RUNNING: "Sedang mengekstrak",
      SUCCEEDED: "Selesai · Perlu tinjauan",
      FAILED_RETRYABLE: "Gagal sementara · Menunggu ulang",
      DEAD_LETTER: "Dead letter · Gagal permanen",
      CANCELLED: "Dibatalkan (fallback manual)",
    } satisfies Record<OcrJobStatus, string>,
    attemptsLabel: "Percobaan",
    candidatesTitle: "Kandidat hasil ekstraksi & koreksi manusia",
    provenanceLabel: "Asal ekstraksi",
    confidenceLabel: "Keyakinan",
    unknownConfidence: "tidak diketahui",
    lowConfidenceBadge: "Keyakinan rendah · Perlu verifikasi",
    promptInjectionAlert:
      "Peringatan keamanan: pola instruksi mencurigakan (prompt injection) terdeteksi pada teks dokumen dan telah dinetralkan. Periksa setiap field secara manual.",
    verifySensitiveCheckbox:
      "Saya telah memverifikasi secara manual NPWP/NIK, mata uang, dan nilai nominal yang bertanda keyakinan rendah atau telah disanitasi.",
    applyCandidatesButton: "Terapkan nilai terverifikasi ke draf",
    alreadyReviewed: "Sudah ditinjau & diterapkan",
    rawLabel: "Mentah",
    normalizedLabel: "Ternormalisasi",
    fieldLabels: {
      invoiceNumber: "Nomor invoice",
      documentDate: "Tanggal dokumen",
      taxPeriod: "Masa pajak",
      counterpartyName: "Nama lawan transaksi",
      counterpartyIdentity: "NPWP / NIK / TIN lawan",
      currency: "Mata uang",
      totalAmount: "Total draf",
      lineDescription: "Uraian baris #1",
      quantity: "Kuantitas #1",
      unitPrice: "Harga satuan #1",
    },
    saved: "Perubahan OCR disimpan.",
    errors: {
      INVALID_ENDPOINT_URL:
        "Endpoint harus menggunakan HTTPS publik yang valid (alamat lokal/privat diblokir untuk mencegah SSRF).",
      INVALID_SECRET_REF:
        "Nama referensi rahasia harus huruf kapital, angka, dan garis bawah (contoh: OCR_PROVIDER_KEY).",
      PROVIDER_NOT_ALLOWED:
        "Penyedia OCR tersebut tidak diaktifkan oleh platform.",
      VENDOR_NOT_APPROVED:
        "Dokumen tidak dapat dikirim karena vendor penyedia belum disetujui.",
      OCR_NOT_CONFIGURED:
        "Penyedia OCR eksternal berstatus NOT_CONFIGURED pada rilis ini.",
      OCR_DISABLED_NONE:
        "OCR ruang kerja diatur ke NONE. Gunakan input manual atau pilih penyedia di Pengaturan OCR.",
      OCR_SECRET_MISSING:
        "Referensi rahasia server untuk penyedia ini belum tersedia di lingkungan server.",
      CONSENT_REQUIRED:
        "Persetujuan tenant wajib dicentang sebelum menggunakan penyedia AI OCR.",
      SPEND_CAP_EXCEEDED:
        "Batas halaman atau batas biaya OCR bulanan ruang kerja telah tercapai.",
      JOB_ALREADY_ACTIVE:
        "Pekerjaan OCR untuk dokumen ini sudah sedang berjalan atau mengantre.",
      LOW_CONFIDENCE_VERIFICATION_REQUIRED:
        "Centang verifikasi manual untuk NPWP/NIK, mata uang, atau nominal berkeyakinan rendah sebelum menerapkan.",
      LINE_PRECISION:
        "Kuantitas × harga satuan harus menghasilkan tepat 2 angka desimal.",
      INVALID_STATE:
        "Status transaksi saat ini tidak mengizinkan tindakan OCR tersebut.",
      NOT_FOUND: "Data OCR atau dokumen tidak ditemukan.",
    },
  },
  en: {
    settingsLink: "OCR settings",
    settingsTitle: "Workspace OCR configuration",
    settingsIntro:
      "OCR defaults to NONE (manual & spreadsheet intake only). Owners or Admins can select an approved platform provider and record tenant data-processing consent.",
    productionBoundary:
      "Production external AI OCR remains NOT_CONFIGURED until vendor approval and server credentials are supplied. Documents are never sent to external AI without approved vendor settings and tenant consent.",
    effectiveStatus: "Effective OCR status",
    effectiveStatuses: {
      NONE_MANUAL: "NONE · Manual & spreadsheet entry only",
      READY: "Ready (configured mode)",
      NOT_CONFIGURED: "NOT_CONFIGURED · Provider or credentials unavailable",
      CONSENT_REQUIRED: "Awaiting tenant AI processing consent",
      VENDOR_NOT_APPROVED: "Blocked · Vendor not approved",
    },
    chooseProvider: "Allowed OCR provider",
    noneOption: "NONE · Disable AI OCR (manual only)",
    consentLabel:
      "I acknowledge and consent to processing this workspace's source documents through the selected provider and region under its stated retention policy.",
    saveSettings: "Save OCR settings",
    managerOnly:
      "Only an Owner or Admin can change workspace OCR provider settings.",
    monthlyUsage: "Usage this month (Asia/Jakarta)",
    pagesUsed: "Pages processed",
    spendUsed: "Estimated spend",
    jobsCount: "Total jobs",
    modelLabel: "Model",
    regionLabel: "Region",
    retentionLabel: "Retention",
    capLabel: "Monthly caps",
    adminTitle: "Platform OCR provider registry (Superadmin)",
    adminIntro:
      "Manage tenant-selectable OCR adapters, server secret env var references, page/spend caps, region, and vendor approval. API keys are never stored in the database or sent to the browser.",
    forbiddenAdmin:
      "Access denied. This page is restricted to platform Superadmins.",
    jobHealthTitle: "OCR job health summary (aggregate)",
    upsertProvider: "Save OCR provider",
    slugLabel: "Provider slug (lowercase alphanumeric/hyphen)",
    displayNameLabel: "Display name",
    adapterKeyLabel: "Adapter",
    adapterKeys: {
      NONE: "NONE (Manual only)",
      SYNTHETIC_TEST: "SYNTHETIC_TEST (Local no-egress test adapter)",
      EXTERNAL_NOT_CONFIGURED:
        "EXTERNAL_NOT_CONFIGURED (External unconfigured)",
    } satisfies Record<OcrAdapterKey, string>,
    endpointUrlLabel: "HTTPS endpoint URL (optional, SSRF-checked)",
    secretRefLabel: "Server secret env var name (optional, e.g. OCR_API_KEY)",
    maxPagesLabel: "Max pages per document",
    timeoutMsLabel: "Timeout (ms)",
    monthlyPageCapLabel: "Monthly page cap per tenant",
    monthlySpendCapLabel: "Monthly spend cap per tenant (IDR)",
    costPerPageLabel: "Estimated cost per page (IDR)",
    retentionPolicyLabel: "Retention policy",
    processorNoticeLabel: "Processor notice / processing basis",
    vendorApprovedLabel: "Vendor approved for document processing",
    enabledLabel: "Enable provider for tenant selection",
    secretReady: "Server secret present",
    secretMissing: "Server secret missing",
    noSecretNeeded: "No external secret required",
    transactionOcrTitle: "OCR candidate extraction & side-by-side correction",
    transactionOcrNotice:
      "OCR produces temporary candidate fields only. AI never selects tax classifications or final tax rates; human review is required before applying values.",
    runOcr: "Run OCR on this document",
    noDocumentsForOcr:
      "Upload a PDF, JPG, or PNG source document first to run OCR extraction.",
    manualFallbackButton: "Fallback to manual entry",
    retryJobButton: "Retry dead-letter job",
    jobsTitle: "OCR job status",
    jobStatuses: {
      QUEUED: "Queued",
      RUNNING: "Extracting",
      SUCCEEDED: "Succeeded · Review required",
      FAILED_RETRYABLE: "Retry scheduled",
      DEAD_LETTER: "Dead letter · Failed",
      CANCELLED: "Cancelled (manual fallback)",
    } satisfies Record<OcrJobStatus, string>,
    attemptsLabel: "Attempts",
    candidatesTitle: "Extracted candidates & human corrections",
    provenanceLabel: "Provenance",
    confidenceLabel: "Confidence",
    unknownConfidence: "unknown",
    lowConfidenceBadge: "Low confidence · Verification required",
    promptInjectionAlert:
      "Security warning: instruction-like text (prompt injection) was detected in the document and neutralized. Review every field manually.",
    verifySensitiveCheckbox:
      "I have manually verified any low-confidence or sanitized Tax ID, currency, and monetary amount fields.",
    applyCandidatesButton: "Apply reviewed values to draft",
    alreadyReviewed: "Reviewed & applied",
    rawLabel: "Raw",
    normalizedLabel: "Normalized",
    fieldLabels: {
      invoiceNumber: "Invoice number",
      documentDate: "Document date",
      taxPeriod: "Tax period",
      counterpartyName: "Counterparty name",
      counterpartyIdentity: "Counterparty Tax ID (NPWP/NIK/TIN)",
      currency: "Currency",
      totalAmount: "Draft total",
      lineDescription: "Line description #1",
      quantity: "Quantity #1",
      unitPrice: "Unit price #1",
    },
    saved: "OCR settings saved.",
    errors: {
      INVALID_ENDPOINT_URL:
        "Endpoint URL must be a valid public HTTPS URL (loopback and private networks are blocked against SSRF).",
      INVALID_SECRET_REF:
        "Secret reference must be an uppercase env var name (e.g. OCR_PROVIDER_KEY).",
      PROVIDER_NOT_ALLOWED: "This OCR provider is not enabled by the platform.",
      VENDOR_NOT_APPROVED:
        "Documents cannot be sent because the vendor has not been approved.",
      OCR_NOT_CONFIGURED:
        "External OCR provider is NOT_CONFIGURED in this release.",
      OCR_DISABLED_NONE:
        "Workspace OCR is set to NONE. Use manual entry or choose an approved provider in OCR settings.",
      OCR_SECRET_MISSING:
        "The configured server secret environment variable is not set.",
      CONSENT_REQUIRED:
        "Tenant consent must be checked before enabling an AI OCR provider.",
      SPEND_CAP_EXCEEDED:
        "Workspace monthly OCR page or spend cap has been reached.",
      JOB_ALREADY_ACTIVE:
        "An OCR job is already queued or running for this document.",
      LOW_CONFIDENCE_VERIFICATION_REQUIRED:
        "Confirm manual verification of low-confidence or sanitized Tax ID, currency, or monetary fields before applying.",
      LINE_PRECISION:
        "Quantity × unit price must produce an exact 2-decimal amount.",
      INVALID_STATE:
        "The current transaction status does not allow this OCR action.",
      NOT_FOUND: "OCR record or document was not found.",
    },
  },
} satisfies Record<Locale, object>;
