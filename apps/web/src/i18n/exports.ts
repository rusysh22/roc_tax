import type { Locale } from "./messages";

export const exportMessages = {
  id: {
    pageTitle: "Ekspor XML Coretax",
    pageIntro:
      "Buat berkas XML dari transaksi yang sudah disetujui dan snapshot pajak terkunci. Tidak ada pengiriman otomatis ke DJP; pengguna mengunggah berkas secara manual ke portal Coretax dan mencatat hasilnya.",
    familyStatusTitle: "Status templat resmi DJP per keluarga dokumen",
    availableBadge: "Tersedia (templat terverifikasi sumber)",
    unverifiedBadge: "Diblokir (templat belum terverifikasi)",
    sourceCitationLabel: "Sumber resmi DJP",
    sourceShaLabel: "SHA-256 sumber",
    schemaShaLabel: "SHA-256 skema XSD",
    publishedLabel: "Tanggal terbit",
    generateTitle: "Buat batch ekspor XML BPPU",
    generateNotice:
      "Satu batch XML hanya boleh berisi transaksi dari perusahaan yang sama, keluarga pajak yang sama (saat ini hanya PPh Unifikasi BPPU), masa pajak yang sama, dan versi templat resmi yang sama.",
    companyLabel: "Perusahaan pemotong",
    familyLabel: "Keluarga pajak",
    periodLabel: "Masa pajak (YYYY-MM)",
    selectAllLabel: "Pilih semua transaksi yang memenuhi syarat",
    eligibleTitle: "Transaksi disetujui yang memenuhi syarat",
    noEligible:
      "Belum ada transaksi yang disetujui/diekspor dengan aturan pajak resmi untuk filter perusahaan, keluarga, dan masa pajak ini.",
    generateButton: "Buat XML Coretax (immutable)",
    generatedOk:
      "Batch XML berhasil dibuat dan divalidasi terhadap skema BPPU.",
    historyTitle: "Riwayat batch ekspor (immutable)",
    noBatches: "Belum ada berkas XML yang diekspor di ruang kerja ini.",
    downloadXml: "Unduh XML",
    versionLabel: "Versi ekspor",
    checksumLabel: "SHA-256 berkas XML",
    totalsLabel: "Total DPP / Pajak",
    itemsCountLabel: "Jumlah bukti potong",
    manualGuideTitle: "Panduan unggah manual ke Coretax DJP",
    manualSteps: [
      "Pastikan Anda masuk ke Coretax DJP menggunakan akun NPWP Pemotong yang sama dengan perusahaan pada batch ini.",
      "Buka modul e-Bupot > BPPU, lalu pilih Impor Data XML dan unggah berkas .xml yang diunduh (tidak ada koneksi/pengiriman otomatis dari SerenTax).",
      "Setelah Coretax memproses berkas, catat hasil resmi secara manual pada batch di bawah agar riwayat rekonsiliasi tetap akurat.",
    ],
    recordOutcomeTitle: "Catat hasil unggah manual Coretax",
    outcomeSubmitted: "Diunggah ke Coretax",
    outcomeAccepted: "Diterima Coretax",
    outcomeRejected: "Ditolak Coretax",
    coretaxRefLabel: "Nomor referensi / tanda terima Coretax (opsional)",
    outcomeNoteLabel: "Catatan validasi Coretax",
    recordOutcomeButton: "Simpan catatan hasil",
    outcomeRecordedOk: "Catatan hasil Coretax disimpan secara append-only.",
    adminTitle: "Registri Templat XML Resmi DJP (Superadmin)",
    adminIntro:
      "Hanya templat yang sumber resmi, hash SHA-256, urutan elemen XSD, dan fixture uji-nya terverifikasi yang dapat diaktifkan (terverifikasi). Jenis pajak lain tetap diblokir sampai templatnya terverifikasi.",
    registerButton: "Daftarkan templat baru",
    verifyButton: "Tandai terverifikasi",
    retireButton: "Hentikan",
    versionTagLabel: "Tag versi templat",
    sourceUrlLabel: "URL sumber resmi (*.pajak.go.id)",
    sourceLabelField: "Label sumber DJP",
    sourceShaField: "SHA-256 berkas sumber (64 hex)",
    xsdHashField: "SHA-256 skema XSD kanonik (64 hex)",
    fixtureVerifiedLabel:
      "Fixture uji terverifikasi terhadap referensi/konverter",
    templateSaved: "Registri templat XML diperbarui.",
    noPermission:
      "Peran Anda tidak memiliki izin ekspor XML (khusus Penyusun, Peninjau, atau Penyetuju).",
    errors: {
      TEMPLATE_UNVERIFIED:
        "Diblokir: templat XML resmi untuk keluarga pajak ini belum diverifikasi atau tidak memiliki generator tervalidasi sumber.",
      TEMPLATE_ALREADY_EXISTS:
        "Tag versi templat untuk keluarga pajak tersebut sudah terdaftar.",
      NOT_FOUND: "Data batch atau perusahaan tidak ditemukan.",
      NOT_APPROVED:
        "Semua transaksi dalam batch harus berstatus disetujui atau sudah diekspor.",
      SNAPSHOT_REQUIRED:
        "Transaksi tidak memiliki snapshot persetujuan terkunci untuk revisi saat ini.",
      PRODUCTION_RULE_UNVERIFIED:
        "Transaksi menggunakan aturan uji sintetis / belum disetujui ahli pajak sehingga tidak dapat diekspor sebagai XML produksi.",
      BATCH_SCOPE_MISMATCH:
        "Seluruh transaksi dalam satu batch XML harus berasal dari perusahaan, keluarga pajak, dan masa pajak yang sama.",
      COMPANY_TAX_ID_REQUIRED:
        "Perusahaan pemotong wajib memiliki NPWP (15/16 digit) dan NITKU/ID TKU (22 digit) yang valid.",
      COUNTERPARTY_TIN_REQUIRED:
        "Lawan transaksi wajib memiliki NPWP (15/16 digit) atau NIK (16 digit).",
      RECIPIENT_TKU_REQUIRED:
        "ID TKU Penerima Penghasilan (22 digit) wajib dilengkapi.",
      UNSUPPORTED_CURRENCY:
        "Ekspor XML Coretax BPPU hanya mendukung transaksi bermata uang IDR.",
      WITHHOLDING_DATE_INVALID:
        "Tanggal pemotongan tidak boleh lebih awal dari masa/tahun pajak bukti potong.",
      XML_VALIDATION_FAILED:
        "Validasi internal skema XSD BPPU gagal; berkas XML tidak disimpan.",
      IDEMPOTENCY_CONFLICT:
        "Kunci idempotensi sudah dipakai untuk permintaan ekspor dengan daftar transaksi berbeda.",
      INTEGRITY_MISMATCH:
        "Hash berkas XML pada penyimpanan privat tidak cocok dengan catatan batch.",
      FORBIDDEN: "Akses ditolak untuk tindakan ekspor ini.",
    },
  },
  en: {
    pageTitle: "Coretax XML Exports",
    pageIntro:
      "Generate XML files only from approved transactions with locked tax snapshots. SerenTax does not submit automatically to DJP; upload downloaded files manually to Coretax and record the outcome here.",
    familyStatusTitle: "Official DJP template status per document family",
    availableBadge: "Available (source-verified template)",
    unverifiedBadge: "Blocked (template not verified)",
    sourceCitationLabel: "Official DJP source",
    sourceShaLabel: "Source SHA-256",
    schemaShaLabel: "XSD schema SHA-256",
    publishedLabel: "Published date",
    generateTitle: "Generate BPPU XML export batch",
    generateNotice:
      "Each XML batch must share the same company, the same tax family (currently only PPh Unification BPPU), the same tax period, and the same verified template version.",
    companyLabel: "Withholding company",
    familyLabel: "Tax family",
    periodLabel: "Tax period (YYYY-MM)",
    selectAllLabel: "Select all eligible transactions",
    eligibleTitle: "Eligible approved transactions",
    noEligible:
      "No approved or exported transactions under an official tax rule match this company, tax family, and tax period yet.",
    generateButton: "Generate Coretax XML (immutable)",
    generatedOk: "XML batch generated and validated against the BPPU schema.",
    historyTitle: "Immutable export batch history",
    noBatches: "No XML batches have been exported in this workspace yet.",
    downloadXml: "Download XML",
    versionLabel: "Export version",
    checksumLabel: "XML SHA-256 checksum",
    totalsLabel: "Total Tax Base / Tax",
    itemsCountLabel: "Slip count",
    manualGuideTitle: "Manual Coretax upload instructions",
    manualSteps: [
      "Sign in to the Coretax DJP portal using the exact same withholding company TIN (NPWP Pemotong) as this batch.",
      "Open e-Bupot > BPPU, select XML import, and upload the downloaded .xml file yourself (SerenTax performs zero automatic submission).",
      "Once Coretax finishes validating your upload, record the official outcome below for reconciliation.",
    ],
    recordOutcomeTitle: "Record manual Coretax outcome",
    outcomeSubmitted: "Uploaded to Coretax",
    outcomeAccepted: "Accepted by Coretax",
    outcomeRejected: "Rejected by Coretax",
    coretaxRefLabel: "Coretax receipt / reference number (optional)",
    outcomeNoteLabel: "Coretax validation note",
    recordOutcomeButton: "Save outcome record",
    outcomeRecordedOk: "Coretax outcome recorded append-only.",
    adminTitle: "Official DJP XML Template Registry (Superadmin)",
    adminIntro:
      "Only templates with verified official DJP source URL, SHA-256 checksum, derived XSD element ordering, and passing fixture tests may be marked verified. Other tax families stay blocked until their template is verified.",
    registerButton: "Register template",
    verifyButton: "Mark verified",
    retireButton: "Retire",
    versionTagLabel: "Template version tag",
    sourceUrlLabel: "Official source URL (*.pajak.go.id)",
    sourceLabelField: "DJP source label",
    sourceShaField: "Source artifact SHA-256 (64 hex)",
    xsdHashField: "Canonical XSD schema SHA-256 (64 hex)",
    fixtureVerifiedLabel:
      "Fixture suite verified against official reference/converter",
    templateSaved: "XML template registry updated.",
    noPermission:
      "Your workspace role cannot generate or record XML exports (Preparer, Reviewer, or Approver required).",
    errors: {
      TEMPLATE_UNVERIFIED:
        "Blocked: official XML template for this tax family is unverified or has no source-verified serializer.",
      TEMPLATE_ALREADY_EXISTS:
        "That template version tag already exists for this tax family.",
      NOT_FOUND: "Export batch or company was not found.",
      NOT_APPROVED:
        "Every transaction in an export batch must be approved or already exported.",
      SNAPSHOT_REQUIRED:
        "Transaction is missing an immutable approval snapshot for its current version.",
      PRODUCTION_RULE_UNVERIFIED:
        "Transaction was approved under a synthetic test or unapproved rule and cannot produce production XML.",
      BATCH_SCOPE_MISMATCH:
        "All transactions in a batch must belong to the same company, tax family, and tax period.",
      COMPANY_TAX_ID_REQUIRED:
        "Withholding company must have a valid 15/16-digit NPWP and 22-digit NITKU.",
      COUNTERPARTY_TIN_REQUIRED:
        "Counterparty must have a valid 15/16-digit NPWP or 16-digit NIK.",
      RECIPIENT_TKU_REQUIRED:
        "Income recipient ID TKU (22 digits) must be provided.",
      UNSUPPORTED_CURRENCY: "Coretax BPPU XML export requires IDR currency.",
      WITHHOLDING_DATE_INVALID:
        "Withholding date cannot be earlier than the tax period month/year.",
      XML_VALIDATION_FAILED:
        "Internal BPPU XSD schema validation failed; XML artifact was rejected.",
      IDEMPOTENCY_CONFLICT:
        "Idempotency key was already used with a different export selection.",
      INTEGRITY_MISMATCH:
        "Stored XML checksum does not match immutable batch metadata.",
      FORBIDDEN: "You are not permitted to perform XML export actions.",
    },
  },
} satisfies Record<Locale, object>;
