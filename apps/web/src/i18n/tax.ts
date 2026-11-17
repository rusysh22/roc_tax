import type { Locale } from "./messages";
import type {
  SegregationPolicy,
  TaxBlockerCode,
  TaxRoundingMode,
  TaxRuleStatus,
} from "../lib/intake/tax-rules";

export const taxMessages = {
  id: {
    panelTitle: "Klasifikasi pajak, mesin aturan & alur tinjauan",
    panelNotice:
      "Mesin aturan bersifat deterministik dan berversi tanggal berlaku. Tidak ada kode objek atau tarif pajak Indonesia yang diisikan otomatis tanpa katalog yang disetujui ahli pajak (SME).",
    nonProductionBanner:
      "PERINGATAN NON_PRODUCTION: Evaluasi ini menggunakan aturan uji sintetis (NON_PRODUCTION_TEST). Persetujuan pajak produksi tetap diblokir sampai katalog aturan resmi disetujui ahli pajak.",
    pph21Requirement:
      "Keluarga PPh 21 (BP21/BPMP/BPA1/BPA2) memerlukan referensi data penggajian/riwayat penghasilan dan tidak dapat disimpulkan dari satu invoice saja.",
    pph26Requirement:
      "Keluarga PPh 26 (BP26) memerlukan bukti dokumen traktat (SKD/Form DGT) dan kode negara domisili mitra sebelum evaluasi dapat diselesaikan.",
    segregationTitle: "Kebijakan pemisahan tugas (Segregation of duties)",
    segregationPolicies: {
      STRICT_SEPARATION:
        "Pemisahan ketat (Default): pembuat, pengaju, atau peninjau tidak dapat menyetujui dokumennya sendiri.",
      SOLE_USER_EXCEPTION:
        "Pengecualian pengguna tunggal: mengizinkan persetujuan sendiri dengan peringatan terlihat dan jejak audit.",
    } satisfies Record<SegregationPolicy, string>,
    savePolicy: "Simpan kebijakan pajak",
    policySaved: "Kebijakan pemisahan tugas disimpan.",
    taxFamilyLabel: "Keluarga dokumen",
    objectCodeLabel: "Kode objek pajak",
    payrollRefLabel: "Referensi data penggajian (wajib untuk PPh 21)",
    treatyRefLabel: "Referensi dokumen traktat / SKD (wajib untuk PPh 26)",
    treatyCountryLabel: "Kode negara traktat (2 huruf ISO)",
    overrideNoteLabel: "Catatan / justifikasi tinjauan",
    evaluateButton: "Evaluasi aturan pajak",
    submitButton: "Ajukan untuk tinjauan",
    requestChangesButton: "Minta perbaikan",
    approveButton: "Setujui & kunci snapshot",
    reopenButton: "Buka kembali revisi disetujui",
    reasonLabel: "Alasan (wajib)",
    soleUserWarning:
      "Peringatan pemisahan tugas: Anda adalah pembuat/pengaju/peninjau draf ini. Persetujuan akan dicatat sebagai pengecualian pengguna tunggal di log audit.",
    soleUserAckLabel:
      "Saya memahami peringatan ini dan mencatat persetujuan pengecualian pengguna tunggal.",
    dppLabel: "DPP",
    taxAmountLabel: "Nilai pajak terhitung",
    rateLabel: "Tarif",
    roundingLabel: "Pembulatan",
    roundingModes: {
      HALF_UP: "HALF_UP (pembulatan standar)",
      FLOOR: "FLOOR (pembulatan ke bawah)",
      CEIL: "CEIL (pembulatan ke atas)",
    } satisfies Record<TaxRoundingMode, string>,
    ruleLabel: "Aturan & versi",
    citationLabel: "Dasar peraturan / sumber",
    effectiveLabel: "Masa berlaku",
    diffLabel: "Perubahan dari evaluasi sebelumnya",
    blockersTitle: "Penghambat validasi (harus diselesaikan)",
    noBlockers: "Tidak ada penghambat data pada aturan terpilih.",
    snapshotsTitle: "Snapshot persetujuan terkunci (immutable)",
    noSnapshots: "Belum ada snapshot persetujuan.",
    evaluationsTitle: "Riwayat evaluasi aturan",
    noEvaluations: "Belum ada evaluasi aturan untuk draf ini.",
    ruleStatuses: {
      DRAFT: "Draf",
      SME_APPROVED: "Disetujui SME (Produksi)",
      NON_PRODUCTION_TEST: "NON_PRODUCTION_TEST (Uji sintetis)",
      RETIRED: "Dihentikan",
    } satisfies Record<TaxRuleStatus, string>,
    adminRulesTitle: "Katalog aturan pajak berversi (Superadmin)",
    adminRulesIntro:
      "Kelola aturan pajak deterministik berversi dan tanggal berlaku. Tidak ada tarif pajak Indonesia yang di-seed tanpa peninjauan ahli pajak (SME).",
    codeLabel: "Kode aturan",
    versionLabel: "Versi",
    nameLabel: "Nama aturan",
    effectiveFromLabel: "Berlaku sejak (YYYY-MM-DD)",
    effectiveToLabel: "Berlaku sampai (opsional)",
    numeratorLabel: "Pembilang tarif (mis. 2 untuk 2%)",
    denominatorLabel: "Penyebut tarif (mis. 100 untuk 2%)",
    smeReviewerLabel: "Peninjau SME (wajib untuk SME_APPROVED)",
    requireIdentityLabel: "Wajibkan identitas pajak lawan transaksi",
    requirePayrollLabel: "Wajibkan bukti penggajian (PPh 21)",
    requireTreatyLabel: "Wajibkan dokumen traktat/SKD (PPh 26)",
    createRuleButton: "Simpan versi aturan pajak",
    blockers: {
      UNCLASSIFIED_FAMILY:
        "Keluarga pajak masih UNCLASSIFIED. Pilih keluarga dokumen pajak sebelum evaluasi.",
      PPH21_PAYROLL_REQUIRED:
        "PPh 21 memerlukan referensi data penggajian; tidak dapat disimpulkan dari invoice saja.",
      PPH26_TREATY_REQUIRED:
        "PPh 26 memerlukan referensi dokumen traktat (SKD/Form DGT) dan kode negara.",
      MISSING_OBJECT_CODE: "Isi kode objek pajak terlebih dahulu.",
      NO_MATCHING_RULE:
        "Tidak ada aturan pajak yang cocok untuk keluarga, jenis dokumen, kode objek, dan tanggal dokumen ini.",
      COUNTERPARTY_IDENTITY_REQUIRED:
        "Aturan ini mewajibkan lawan transaksi memiliki identitas pajak (NPWP/NIK/TIN).",
      RULE_NOT_SME_APPROVED:
        "Aturan yang cocok belum berstatus SME_APPROVED (hanya uji NON_PRODUCTION); persetujuan produksi diblokir.",
    } satisfies Record<TaxBlockerCode, string>,
    errors: {
      SME_REVIEW_REQUIRED:
        "Nama peninjau ahli pajak (SME) wajib diisi untuk status SME_APPROVED.",
      INVALID_EFFECTIVE_RANGE:
        "Tanggal berakhir berlaku tidak boleh lebih awal dari tanggal mulai berlaku.",
      INVALID_TAX_RATE:
        "Rasio tarif tidak valid (pembilang harus <= penyebut).",
      EVALUATION_REQUIRED: "Jalankan evaluasi aturan pajak terlebih dahulu.",
      EVALUATION_STALE:
        "Data transaksi berubah setelah evaluasi terakhir. Evaluasi ulang sebelum mengajukan atau menyetujui.",
      EVALUATION_HAS_BLOCKERS:
        "Masih terdapat penghambat validasi pada evaluasi terakhir.",
      PRODUCTION_RULE_UNVERIFIED:
        "Persetujuan produksi diblokir sampai aturan pajak berstatus SME_APPROVED tersedia dan tervalidasi.",
      SELF_APPROVAL_BLOCKED:
        "Kebijakan pemisahan tugas menolak persetujuan oleh pembuat, pengaju, atau peninjau transaksi yang sama.",
      SOLE_USER_ACK_REQUIRED:
        "Centang konfirmasi pengecualian pengguna tunggal sebelum menyetujui.",
      INVALID_STATE:
        "Status transaksi saat ini tidak mengizinkan transisi alur tinjauan tersebut.",
      STALE_VERSION:
        "Versi transaksi telah berubah oleh pengguna lain. Muat ulang halaman.",
      NOT_FOUND: "Transaksi atau aturan pajak tidak ditemukan.",
    },
    saved: "Proses pajak & tinjauan berhasil disimpan.",
  },
  en: {
    panelTitle: "Tax classification, rule engine & review workflow",
    panelNotice:
      "The rule engine is deterministic and effective-dated. No Indonesian tax codes or statutory tariffs are seeded without Tax SME approval.",
    nonProductionBanner:
      "NON_PRODUCTION WARNING: This evaluation used a synthetic fixture rule (NON_PRODUCTION_TEST). Production tax approval stays blocked until an SME-approved catalog exists.",
    pph21Requirement:
      "PPh 21 families (BP21/BPMP/BPA1/BPA2) require separate payroll/income history references and cannot be inferred from a single invoice.",
    pph26Requirement:
      "PPh 26 (BP26) requires treaty/SKD (Form DGT) certificate evidence and counterparty treaty country code before evaluation can pass.",
    segregationTitle: "Segregation-of-duties policy",
    segregationPolicies: {
      STRICT_SEPARATION:
        "Strict separation (Default): creator, submitter, or reviewer cannot approve their own transaction.",
      SOLE_USER_EXCEPTION:
        "Sole-user exception: permits self-approval with visible warning and audit trail.",
    } satisfies Record<SegregationPolicy, string>,
    savePolicy: "Save tax policy",
    policySaved: "Segregation-of-duties policy saved.",
    taxFamilyLabel: "Tax document family",
    objectCodeLabel: "Tax object code",
    payrollRefLabel: "Payroll data reference (required for PPh 21)",
    treatyRefLabel: "Treaty / SKD evidence reference (required for PPh 26)",
    treatyCountryLabel: "Treaty country code (2-letter ISO)",
    overrideNoteLabel: "Review justification / note",
    evaluateButton: "Evaluate tax rule",
    submitButton: "Submit for review",
    requestChangesButton: "Request changes",
    approveButton: "Approve & lock snapshot",
    reopenButton: "Reopen approved revision",
    reasonLabel: "Reason (required)",
    soleUserWarning:
      "Segregation warning: you created, submitted, or reviewed this draft. Approving will be recorded as a sole-user exception in the audit trail.",
    soleUserAckLabel:
      "I acknowledge this warning and record a sole-user exception approval.",
    dppLabel: "Tax base (DPP)",
    taxAmountLabel: "Calculated tax",
    rateLabel: "Rate",
    roundingLabel: "Rounding",
    roundingModes: {
      HALF_UP: "HALF_UP (standard half-up)",
      FLOOR: "FLOOR (round down)",
      CEIL: "CEIL (round up)",
    } satisfies Record<TaxRoundingMode, string>,
    ruleLabel: "Rule & version",
    citationLabel: "Source citation",
    effectiveLabel: "Effective window",
    diffLabel: "Diff from prior evaluation",
    blockersTitle: "Validation blockers (must be resolved)",
    noBlockers: "No missing-data blockers on the matched rule.",
    snapshotsTitle: "Locked approval snapshots (immutable)",
    noSnapshots: "No approval snapshots yet.",
    evaluationsTitle: "Rule evaluation history",
    noEvaluations: "No tax rule evaluations yet.",
    ruleStatuses: {
      DRAFT: "Draft",
      SME_APPROVED: "SME Approved (Production)",
      NON_PRODUCTION_TEST: "NON_PRODUCTION_TEST (Synthetic fixture)",
      RETIRED: "Retired",
    } satisfies Record<TaxRuleStatus, string>,
    adminRulesTitle: "Versioned tax rule catalog (Superadmin)",
    adminRulesIntro:
      "Manage effective-dated deterministic tax rules. No Indonesian statutory rates are seeded without Tax SME sign-off.",
    codeLabel: "Rule code",
    versionLabel: "Version",
    nameLabel: "Rule name",
    effectiveFromLabel: "Effective from (YYYY-MM-DD)",
    effectiveToLabel: "Effective to (optional)",
    numeratorLabel: "Rate numerator (e.g. 2 for 2%)",
    denominatorLabel: "Rate denominator (e.g. 100 for 2%)",
    smeReviewerLabel: "SME reviewer name (required for SME_APPROVED)",
    requireIdentityLabel: "Require counterparty tax identity",
    requirePayrollLabel: "Require payroll evidence (PPh 21)",
    requireTreatyLabel: "Require treaty/SKD evidence (PPh 26)",
    createRuleButton: "Save tax rule version",
    blockers: {
      UNCLASSIFIED_FAMILY:
        "Tax family is UNCLASSIFIED. Choose a tax document family before evaluation.",
      PPH21_PAYROLL_REQUIRED:
        "PPh 21 requires payroll/history evidence and cannot be inferred from an invoice alone.",
      PPH26_TREATY_REQUIRED:
        "PPh 26 requires treaty/SKD (Form DGT) evidence and treaty country code.",
      MISSING_OBJECT_CODE: "Provide a tax object code first.",
      NO_MATCHING_RULE:
        "No matching tax rule was found for this family, document type, object code, and document date.",
      COUNTERPARTY_IDENTITY_REQUIRED:
        "This rule requires the counterparty to have a tax identity (NPWP/NIK/TIN).",
      RULE_NOT_SME_APPROVED:
        "The matched rule is not SME_APPROVED (NON_PRODUCTION test fixture); production approval is blocked.",
    } satisfies Record<TaxBlockerCode, string>,
    errors: {
      SME_REVIEW_REQUIRED:
        "SME reviewer identity is required before setting status to SME_APPROVED.",
      INVALID_EFFECTIVE_RANGE:
        "Effective-to date cannot be earlier than effective-from date.",
      INVALID_TAX_RATE:
        "Invalid tax rate ratio (numerator must be <= denominator).",
      EVALUATION_REQUIRED:
        "Run tax rule evaluation before submitting or approving.",
      EVALUATION_STALE:
        "Transaction values changed after the last evaluation. Re-evaluate first.",
      EVALUATION_HAS_BLOCKERS:
        "The latest tax evaluation still has unresolved blockers.",
      PRODUCTION_RULE_UNVERIFIED:
        "Production approval is blocked until an SME_APPROVED rule catalog exists and validates.",
      SELF_APPROVAL_BLOCKED:
        "Segregation-of-duties policy prevents the creator, submitter, or reviewer from approving their own record.",
      SOLE_USER_ACK_REQUIRED:
        "Confirm the sole-user exception acknowledgment before approving.",
      INVALID_STATE:
        "The current transaction status does not allow this review transition.",
      STALE_VERSION: "Transaction version changed elsewhere. Reload the page.",
      NOT_FOUND: "Transaction or tax rule was not found.",
    },
    saved: "Tax evaluation & review action saved.",
  },
} satisfies Record<Locale, object>;
