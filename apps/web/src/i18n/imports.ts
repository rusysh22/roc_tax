import type { Locale } from "./messages";
import type { ImportColumn, ImportIssueCode } from "../lib/intake/spreadsheet";

export const importMessages = {
  id: {
    title: "Impor spreadsheet & pratinjau batch",
    intro:
      "Unduh templat netral-pajak (.csv atau .xlsx), petakan kolom, tinjau validasi per baris, dan simpan draf dengan pemeriksaan kuota uji coba di server.",
    templatesTitle: "Templat impor netral-pajak",
    templatesBody:
      "Setiap baris mewakili satu draf invoice satu-baris. Tidak ada rumus spreadsheet yang dieksekusi saat impor, dan sel ekspor disanitasi dari injeksi formula.",
    downloadCsv: "Unduh templat CSV",
    downloadXlsx: "Unduh templat XLSX",
    uploadTitle: "Unggah & pratinjau berkas",
    selectCompany: "Perusahaan tujuan",
    selectFile:
      "Berkas spreadsheet (.csv atau .xlsx, maks 2 MB, maks 200 baris)",
    previewButton: "Pratinjau baris & validasi",
    repreviewButton: "Perbarui pratinjau dengan pemetaan ini",
    mappingTitle: "Pemetaan kolom",
    unmapped: "— Tidak dipetakan —",
    summaryTitle: "Ringkasan pratinjau",
    totalRows: "Total baris",
    validRows: "Baris valid",
    invalidRows: "Baris tidak valid",
    duplicateRows: "Baris dengan peringatan duplikat",
    downloadErrorReport: "Unduh laporan kesalahan (.csv)",
    commitButton: "Impor baris valid (gunakan 1 kuota trial)",
    commitButtonEntitled: "Impor semua baris valid (kuota langganan)",
    entitledNotice:
      "Ruang kerja ini memiliki langganan aktif: seluruh baris valid disimpan sekaligus dalam satu transaksi database, dalam batas kuota transaksi bulanan paket Anda.",
    acknowledgeDuplicates:
      "Saya sudah memeriksa peringatan duplikat pada pratinjau ini dan ingin tetap mengimpor baris valid.",
    trialSingleRowNotice:
      "Uji coba akun mengizinkan maksimal 1 transaksi baru per hari kalender Asia/Jakarta. Karena belum ada paket berbayar aktif, berkas dengan lebih dari 1 baris valid tidak dapat dibuat sekaligus; unggah 1 baris valid per hari atau perbaiki berkas terlebih dahulu.",
    rowNumber: "Baris",
    rowStatus: "Status",
    valid: "Valid",
    invalid: "Tidak valid",
    issuesColumn: "Masalah & peringatan",
    noIssues: "Siap diimpor",
    historyTitle: "Riwayat batch impor",
    noHistory: "Belum ada riwayat batch impor di ruang kerja ini.",
    createdCount: "Draf dibuat",
    fileHash: "SHA-256 berkas",
    committedSuccess: "Batch impor berhasil disimpan.",
    columns: {
      invoiceNumber: "Nomor invoice *",
      documentDate: "Tanggal dokumen (YYYY-MM-DD) *",
      taxPeriod: "Masa pajak (YYYY-MM) *",
      documentType: "Jenis dokumen (SUPPLIER_INVOICE/SALES_INVOICE) *",
      taxFamily: "Keluarga dokumen *",
      counterpartyName: "Nama lawan transaksi *",
      counterpartyIdentity: "NPWP/NIK/TIN lawan transaksi (opsional)",
      description: "Keterangan header (opsional)",
      lineDescription: "Uraian baris *",
      quantity: "Kuantitas *",
      unitPrice: "Harga satuan (IDR) *",
      currency: "Mata uang (IDR) *",
    } satisfies Record<ImportColumn, string>,
    issueCodes: {
      FORMULA_INJECTION:
        "Mengandung formula spreadsheet atau awalan tidak aman (=, +, -, @).",
      MISSING_COLUMN: "Kolom wajib belum dipetakan.",
      INVALID_INVOICE_NUMBER: "Nomor invoice wajib diisi (maks 64 karakter).",
      INVALID_DATE: "Tanggal harus berformat YYYY-MM-DD yang valid.",
      FUTURE_DATE: "Tanggal dokumen lebih dari 7 hari ke depan.",
      DATE_TOO_OLD: "Tanggal dokumen sebelum 2000-01-01.",
      INVALID_PERIOD: "Masa pajak harus berformat YYYY-MM.",
      INVALID_DOCUMENT_TYPE: "Gunakan SUPPLIER_INVOICE atau SALES_INVOICE.",
      BLOCKED_TAX_FAMILY:
        "Keluarga PPh 21 / PPh 26 memerlukan data penggajian atau traktat dan dikunci pada impor invoice.",
      INVALID_TAX_FAMILY:
        "Gunakan UNCLASSIFIED, PPH_UNIFIKASI_BPPU, PPN_FAKTUR_KELUARAN, atau PPH_UNIFIKASI_BPNR.",
      FAMILY_DOCUMENT_TYPE:
        "Jenis dokumen tidak sesuai dengan keluarga pajak yang dipilih.",
      UNKNOWN_COUNTERPARTY:
        "Lawan transaksi tidak ditemukan pada ruang kerja ini.",
      AMBIGUOUS_COUNTERPARTY:
        "Ada lebih dari satu lawan transaksi dengan nama yang sama; isi kolom identitas pajak.",
      COUNTERPARTY_KIND:
        "Peran lawan transaksi (vendor/pelanggan) tidak sesuai dengan jenis invoice.",
      INVALID_DESCRIPTION: "Keterangan melebihi 1000 karakter.",
      INVALID_LINE_DESCRIPTION: "Uraian baris wajib diisi (maks 500 karakter).",
      INVALID_QUANTITY:
        "Kuantitas harus angka desimal positif (maks 4 desimal).",
      INVALID_UNIT_PRICE:
        "Harga satuan harus angka desimal non-negatif (maks 2 desimal).",
      LINE_PRECISION:
        "Kuantitas × harga satuan harus menghasilkan tepat 2 desimal tanpa pembulatan.",
      INVALID_CURRENCY: "Hanya mata uang IDR yang didukung saat ini.",
      DUPLICATE_IN_FILE:
        "Nomor invoice dan lawan transaksi ganda di dalam berkas yang sama.",
    } satisfies Record<ImportIssueCode, string>,
    errors: {
      SPREADSHEET_EMPTY: "Berkas spreadsheet kosong.",
      SPREADSHEET_TOO_LARGE:
        "Ukuran berkas atau isi XML melebihi batas keamanan.",
      SPREADSHEET_FORMAT:
        "Format berkas tidak cocok dengan ekstensi (.csv atau .xlsx).",
      SPREADSHEET_MALFORMED:
        "Berkas CSV/XLSX rusak, tidak lengkap, atau memiliki kolom duplikat.",
      SPREADSHEET_UNSAFE_XML:
        "Berkas XLSX ditolak karena mengandung deklarasi XML DOCTYPE/ENTITY.",
      SPREADSHEET_TOO_MANY_ROWS: "Berkas melebihi batas 200 baris data.",
      SPREADSHEET_TOO_MANY_COLUMNS: "Berkas melebihi batas 32 kolom.",
      SPREADSHEET_NO_DATA: "Berkas tidak memiliki baris data untuk diimpor.",
      MAPPING_INCOMPLETE:
        "Lengkapi seluruh pemetaan kolom wajib terlebih dahulu.",
      NO_VALID_ROWS: "Tidak ada baris valid yang dapat disimpan.",
      DUPLICATE_WARNING:
        "Terdapat peringatan invoice duplikat. Centang konfirmasi duplikat jika ingin tetap mengimpor.",
      TRIAL_SINGLE_ROW_LIMIT:
        "Kuota uji coba hanya mengizinkan maksimal 1 transaksi baru per hari Jakarta. Tidak ada baris yang disimpan secara parsial.",
      MONTHLY_LIMIT:
        "Kuota transaksi bulanan paket langganan tidak mencukupi untuk seluruh baris valid. Tidak ada baris yang disimpan.",
      ENTITLEMENT_MISSING:
        "Lisensi langganan tidak memuat hak MONTHLY_TRANSACTIONS yang valid. Hubungi admin penagihan.",
      IDEMPOTENCY_CONFLICT:
        "Kunci permintaan batch sudah digunakan untuk berkas atau pemetaan berbeda.",
      UNKNOWN_COMPANY: "Pilih perusahaan aktif dari ruang kerja ini.",
      ARCHIVED_COMPANY:
        "Perusahaan yang diarsipkan tidak dapat menerima impor.",
    },
  },
  en: {
    title: "Spreadsheet import & batch preview",
    intro:
      "Download a tax-neutral template (.csv or .xlsx), map columns, inspect row-by-row validation, and commit drafts under server-side trial quota enforcement.",
    templatesTitle: "Tax-neutral import templates",
    templatesBody:
      "Each row represents a single-line invoice draft. Spreadsheet formulas are never executed on import, and exported cells are neutralized against formula injection.",
    downloadCsv: "Download CSV template",
    downloadXlsx: "Download XLSX template",
    uploadTitle: "Upload & preview file",
    selectCompany: "Target company",
    selectFile: "Spreadsheet file (.csv or .xlsx, max 2 MB, max 200 rows)",
    previewButton: "Preview rows & validate",
    repreviewButton: "Update preview with this mapping",
    mappingTitle: "Column mapping",
    unmapped: "— Not mapped —",
    summaryTitle: "Preview summary",
    totalRows: "Total rows",
    validRows: "Valid rows",
    invalidRows: "Invalid rows",
    duplicateRows: "Rows with duplicate warnings",
    downloadErrorReport: "Download error report (.csv)",
    commitButton: "Import valid row (uses 1 trial slot)",
    commitButtonEntitled: "Import all valid rows (subscription quota)",
    entitledNotice:
      "This workspace has an active subscription: all valid rows are saved together in one database transaction, within your plan's monthly transaction quota.",
    acknowledgeDuplicates:
      "I have reviewed the duplicate warnings in this preview and want to import the valid row anyway.",
    trialSingleRowNotice:
      "The account trial permits at most 1 new transaction per Asia/Jakarta calendar day. Because no paid plan is active yet, multiple valid rows cannot all be created at once; upload 1 valid row per day or adjust the file first.",
    rowNumber: "Row",
    rowStatus: "Status",
    valid: "Valid",
    invalid: "Invalid",
    issuesColumn: "Issues & warnings",
    noIssues: "Ready to import",
    historyTitle: "Import batch history",
    noHistory: "No spreadsheet import batches in this workspace yet.",
    createdCount: "Drafts created",
    fileHash: "File SHA-256",
    committedSuccess: "Import batch committed.",
    columns: {
      invoiceNumber: "Invoice number *",
      documentDate: "Document date (YYYY-MM-DD) *",
      taxPeriod: "Tax period (YYYY-MM) *",
      documentType: "Document type (SUPPLIER_INVOICE/SALES_INVOICE) *",
      taxFamily: "Document family *",
      counterpartyName: "Counterparty name *",
      counterpartyIdentity: "Counterparty tax ID (optional)",
      description: "Header description (optional)",
      lineDescription: "Line description *",
      quantity: "Quantity *",
      unitPrice: "Unit price (IDR) *",
      currency: "Currency (IDR) *",
    } satisfies Record<ImportColumn, string>,
    issueCodes: {
      FORMULA_INJECTION:
        "Contains a spreadsheet formula or unsafe leading character (=, +, -, @).",
      MISSING_COLUMN: "Required column is not mapped.",
      INVALID_INVOICE_NUMBER: "Invoice number is required (max 64 chars).",
      INVALID_DATE: "Date must be a valid YYYY-MM-DD calendar date.",
      FUTURE_DATE: "Document date is more than 7 days in the future.",
      DATE_TOO_OLD: "Document date is before 2000-01-01.",
      INVALID_PERIOD: "Tax period must use YYYY-MM format.",
      INVALID_DOCUMENT_TYPE: "Use SUPPLIER_INVOICE or SALES_INVOICE.",
      BLOCKED_TAX_FAMILY:
        "PPh 21 / PPh 26 families require payroll or treaty data and are locked for invoice imports.",
      INVALID_TAX_FAMILY:
        "Use UNCLASSIFIED, PPH_UNIFIKASI_BPPU, PPN_FAKTUR_KELUARAN, or PPH_UNIFIKASI_BPNR.",
      FAMILY_DOCUMENT_TYPE:
        "Document type does not match the selected tax family.",
      UNKNOWN_COUNTERPARTY: "Counterparty was not found in this workspace.",
      AMBIGUOUS_COUNTERPARTY:
        "Multiple counterparties share this name; provide the tax ID column.",
      COUNTERPARTY_KIND:
        "Counterparty role (vendor/customer) does not match the invoice type.",
      INVALID_DESCRIPTION: "Description exceeds 1000 characters.",
      INVALID_LINE_DESCRIPTION: "Line description is required (max 500 chars).",
      INVALID_QUANTITY:
        "Quantity must be a positive decimal (up to 4 decimals).",
      INVALID_UNIT_PRICE:
        "Unit price must be a non-negative decimal (up to 2 decimals).",
      LINE_PRECISION:
        "Quantity × unit price must produce an exact 2-decimal amount without rounding.",
      INVALID_CURRENCY: "Only IDR currency is supported at this stage.",
      DUPLICATE_IN_FILE:
        "Duplicate invoice number and counterparty within the same file.",
    } satisfies Record<ImportIssueCode, string>,
    errors: {
      SPREADSHEET_EMPTY: "The spreadsheet file is empty.",
      SPREADSHEET_TOO_LARGE:
        "The file size or decompressed XML exceeds safety limits.",
      SPREADSHEET_FORMAT:
        "File contents do not match the declared extension (.csv or .xlsx).",
      SPREADSHEET_MALFORMED:
        "The CSV/XLSX file is malformed, incomplete, or has duplicate headers.",
      SPREADSHEET_UNSAFE_XML:
        "The XLSX file was rejected because it contains XML DOCTYPE/ENTITY declarations.",
      SPREADSHEET_TOO_MANY_ROWS: "The file exceeds the 200-row limit.",
      SPREADSHEET_TOO_MANY_COLUMNS: "The file exceeds the 32-column limit.",
      SPREADSHEET_NO_DATA: "The file contains no data rows to import.",
      MAPPING_INCOMPLETE: "Complete all required column mappings first.",
      NO_VALID_ROWS: "There are no valid rows to commit.",
      DUPLICATE_WARNING:
        "Duplicate invoice warnings were found. Check the duplicate confirmation box if you still want to import.",
      TRIAL_SINGLE_ROW_LIMIT:
        "The account trial permits at most 1 new transaction per Jakarta day. No partial rows were saved.",
      MONTHLY_LIMIT:
        "Your plan's remaining monthly transaction quota is not enough for all valid rows. No rows were saved.",
      ENTITLEMENT_MISSING:
        "The subscription license has no valid MONTHLY_TRANSACTIONS entitlement. Contact your billing admin.",
      IDEMPOTENCY_CONFLICT:
        "This batch request key was already used with a different file or mapping.",
      UNKNOWN_COMPANY: "Choose an active company from this workspace.",
      ARCHIVED_COMPANY: "Archived companies cannot receive imports.",
    },
  },
} satisfies Record<Locale, object>;
