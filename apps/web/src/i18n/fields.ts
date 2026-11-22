import type { Locale } from "./messages";

/**
 * Field dictionary — every form field and list column documents itself here:
 * a functional label + explanation for users, and its technical name (the
 * key, `model.field`) for implementers. <FormField field="…"> renders the
 * info tip automatically. A unit test fails if a FormField has no `field`
 * key or a key is missing here (see core_docs/14_UI_STANDARDS.md).
 */
type Entry = { id: [string, string]; en: [string, string] };
const f = (id: [string, string], en: [string, string]): Entry => ({ id, en });

export const fieldDictionary = {
  // Company (withholding entity)
  "company.name": f(
    [
      "Nama tampilan/cabang",
      "Nama singkat perusahaan atau cabang yang muncul di daftar dan pilihan.",
    ],
    [
      "Display/branch name",
      "Short company or branch name shown in lists and pickers.",
    ],
  ),
  "company.legalName": f(
    ["Nama badan hukum", "Nama resmi sesuai akta/NPWP."],
    ["Legal name", "Official name as registered for tax."],
  ),
  "company.npwp": f(
    [
      "NPWP",
      "NPWP pemotong (15/16 digit). Disimpan terenkripsi; wajib untuk ekspor XML.",
    ],
    [
      "Tax ID (NPWP)",
      "Withholder tax ID (15/16 digits). Stored encrypted; required for XML export.",
    ],
  ),
  "company.nitku": f(
    [
      "NITKU",
      "Nomor Identitas Tempat Kegiatan Usaha (22 digit). Wajib untuk ekspor XML.",
    ],
    [
      "Business place ID (NITKU)",
      "22-digit business place identifier. Required for XML export.",
    ],
  ),
  "company.address": f(
    ["Alamat", "Alamat perusahaan atau cabang (opsional)."],
    ["Address", "Company or branch address (optional)."],
  ),
  // Counterparty
  "counterparty.name": f(
    ["Nama lawan transaksi", "Nama vendor atau pelanggan."],
    ["Counterparty name", "Vendor or customer name."],
  ),
  "counterparty.kind": f(
    ["Jenis", "Vendor (penerima yang dipotong), pelanggan, atau keduanya."],
    ["Kind", "Vendor (payee withheld), customer, or both."],
  ),
  "counterparty.identityType": f(
    [
      "Jenis identitas pajak",
      "NPWP atau NIK wajib untuk ekspor BPPU; TIN untuk luar negeri.",
    ],
    [
      "Tax identity type",
      "NPWP or NIK is required for BPPU export; TIN for foreign parties.",
    ],
  ),
  "counterparty.identity": f(
    [
      "Nomor identitas pajak",
      "Disimpan terenkripsi dan ditampilkan tersamar. Kosongkan untuk mempertahankan nilai lama.",
    ],
    [
      "Tax identity number",
      "Stored encrypted and shown masked. Leave empty to keep the current value.",
    ],
  ),
  "counterparty.countryCode": f(
    ["Kode negara", "Kode negara 2 huruf (ID, SG, …)."],
    ["Country code", "Two-letter country code (ID, SG, …)."],
  ),
  "counterparty.address": f(
    ["Alamat", "Alamat lawan transaksi (opsional)."],
    ["Address", "Counterparty address (optional)."],
  ),
  // Transaction
  "transaction.invoiceNumber": f(
    [
      "Nomor invoice",
      "Nomor dokumen sumber; dipakai untuk mendeteksi duplikat.",
    ],
    ["Invoice number", "Source document number; used for duplicate detection."],
  ),
  "transaction.companyId": f(
    ["Perusahaan", "Perusahaan pemotong pajak untuk transaksi ini."],
    ["Company", "The withholding company for this transaction."],
  ),
  "transaction.counterpartyId": f(
    ["Lawan transaksi", "Vendor atau pelanggan. Ketik untuk mencari."],
    ["Counterparty", "Vendor or customer. Type to search."],
  ),
  "transaction.taxFamily": f(
    [
      "Jenis bukti potong",
      "Menentukan aturan pajak dan format XML (misalnya BPPU).",
    ],
    ["Withholding type", "Decides the tax rules and XML format (e.g. BPPU)."],
  ),
  "transaction.documentType": f(
    ["Jenis dokumen sumber", "Invoice pembelian (biaya) atau penjualan."],
    ["Source document type", "Purchase (expense) or sales invoice."],
  ),
  "transaction.documentDate": f(
    [
      "Tanggal dokumen",
      "Tanggal invoice. Menentukan aturan pajak yang berlaku.",
    ],
    ["Document date", "Invoice date. Decides which tax rule applies."],
  ),
  "transaction.taxPeriod": f(
    ["Masa pajak", "Bulan pelaporan (YYYY-MM)."],
    ["Tax period", "Reporting month (YYYY-MM)."],
  ),
  "transaction.currency": f(
    ["Mata uang", "Saat ini hanya IDR."],
    ["Currency", "Only IDR for now."],
  ),
  "transaction.source": f(
    ["Sumber", "Asal data dan versi revisi transaksi."],
    ["Source", "Where the data came from and the revision number."],
  ),
  "transaction.description": f(
    ["Keterangan", "Catatan bebas untuk transaksi (opsional)."],
    ["Description", "Free note for the transaction (optional)."],
  ),
  "transaction.totalAmount": f(
    ["Jumlah", "Total semua baris rincian sebelum pajak (DPP)."],
    ["Amount", "Total of all lines before tax (tax base)."],
  ),
  "transaction.status": f(
    ["Status", "Tahap alur kerja transaksi."],
    ["Status", "Workflow stage of the transaction."],
  ),
  "line.description": f(
    ["Uraian baris", "Deskripsi barang/jasa."],
    ["Line description", "Goods/service description."],
  ),
  "line.quantity": f(
    ["Kuantitas", "Jumlah unit (maks. 4 desimal)."],
    ["Quantity", "Number of units (up to 4 decimals)."],
  ),
  "line.unitPrice": f(
    ["Harga satuan", "Harga per unit dalam IDR (2 desimal)."],
    ["Unit price", "Price per unit in IDR (2 decimals)."],
  ),
  "line.amount": f(
    ["Jumlah baris", "Kuantitas × harga satuan."],
    ["Line amount", "Quantity × unit price."],
  ),
  "transaction.voidReason": f(
    ["Alasan pembatalan", "Wajib diisi; tercatat di riwayat audit."],
    ["Void reason", "Required; recorded in the audit log."],
  ),
  "transaction.reviewReason": f(
    [
      "Alasan",
      "Jelaskan apa yang perlu diperbaiki; terlihat oleh Penyusun dan tercatat di audit.",
    ],
    [
      "Reason",
      "Explain what needs fixing; visible to the Preparer and audited.",
    ],
  ),
  "transaction.soleUserAck": f(
    [
      "Konfirmasi persetujuan sendiri",
      "Wajib bila Anda juga pembuat/pengaju/peninjau dan kebijakan mengizinkan pengecualian.",
    ],
    [
      "Self-approval confirmation",
      "Required when you also created/submitted/reviewed and policy allows the exception.",
    ],
  ),
  "transaction.attachment": f(
    [
      "Lampiran dokumen sumber",
      "PDF/JPG/PNG maks. 10 MB. Disimpan privat dengan sidik jari SHA-256.",
    ],
    [
      "Source document",
      "PDF/JPG/PNG up to 10 MB. Stored privately with a SHA-256 fingerprint.",
    ],
  ),
  "transaction.acknowledgeDuplicates": f(
    [
      "Konfirmasi duplikat",
      "Centang jika transaksi yang mirip memang bukan duplikat.",
    ],
    [
      "Duplicate confirmation",
      "Tick if the similar transactions are really not duplicates.",
    ],
  ),
  // Tax evaluation
  "tax.objectCode": f(
    [
      "Kode objek pajak",
      "Kode objek sesuai aturan pajak yang disetujui. Daftar disaring menurut jenis bukti potong.",
    ],
    [
      "Tax object code",
      "Object code of an approved tax rule. Filtered by withholding type.",
    ],
  ),
  "tax.payrollEvidenceRef": f(
    [
      "Referensi data penggajian",
      "Wajib untuk PPh 21 (nomor/periode data gaji).",
    ],
    [
      "Payroll evidence reference",
      "Required for Art. 21 (payroll record/period).",
    ],
  ),
  "tax.treatyCertificateRef": f(
    [
      "Referensi dokumen traktat/SKD",
      "Wajib untuk PPh 26 (nomor SKD/Form DGT).",
    ],
    [
      "Treaty certificate reference",
      "Required for Art. 26 (certificate of domicile number).",
    ],
  ),
  "tax.treatyCountryCode": f(
    ["Negara traktat", "Kode negara domisili mitra (2 huruf) untuk PPh 26."],
    [
      "Treaty country",
      "Partner's country of residence (2 letters) for Art. 26.",
    ],
  ),
  "tax.smeOverrideNote": f(
    ["Catatan tinjauan", "Justifikasi atau catatan untuk peninjau."],
    ["Review note", "Justification or note for the reviewer."],
  ),
  "tax.decisionReason": f(
    [
      "Alasan keputusan",
      "Wajib diisi saat meminta perbaikan atau menolak; tercatat di riwayat audit.",
    ],
    [
      "Decision reason",
      "Required when requesting changes or rejecting; recorded in the audit log.",
    ],
  ),
  "common.reason": f(
    ["Alasan", "Wajib diisi; tercatat di riwayat audit."],
    ["Reason", "Required; recorded in the audit log."],
  ),
  // Import (and other read-only metrics)
  "counterparty.transactionCount": f(
    [
      "Dipakai di transaksi",
      "Jumlah transaksi yang memakai lawan transaksi ini. Yang sudah dipakai tidak bisa dihapus.",
    ],
    [
      "Used in transactions",
      "Number of transactions using this counterparty. Used ones cannot be deleted.",
    ],
  ),
  "import.createdAt": f(
    ["Waktu impor", "Kapan batch ini disimpan."],
    ["Imported at", "When this batch was saved."],
  ),
  "import.createdBy": f(
    ["Diimpor oleh", "Pengguna yang menjalankan impor."],
    ["Imported by", "User who ran the import."],
  ),
  "import.fileSha256": f(
    ["Sidik jari berkas", "Hash SHA-256 berkas yang diunggah."],
    ["File fingerprint", "SHA-256 hash of the uploaded file."],
  ),
  "import.totalRows": f(
    ["Total baris", "Jumlah baris data di berkas."],
    ["Total rows", "Number of data rows in the file."],
  ),
  "import.validRows": f(
    ["Baris valid", "Baris yang lolos validasi."],
    ["Valid rows", "Rows that passed validation."],
  ),
  "import.invalidRows": f(
    ["Baris tidak valid", "Baris yang ditolak beserta alasannya."],
    ["Invalid rows", "Rows rejected, with reasons."],
  ),
  "import.createdCount": f(
    ["Transaksi dibuat", "Jumlah transaksi baru dari impor ini."],
    ["Transactions created", "New transactions created by this import."],
  ),
  "taxRule.rate": f(
    ["Tarif", "Tarif pajak hasil pembilang ÷ penyebut."],
    ["Rate", "Tax rate as numerator ÷ denominator."],
  ),
  "taxRule.effective": f(
    ["Masa berlaku", "Rentang tanggal dokumen yang memakai aturan ini."],
    ["Effective window", "Document-date range using this rule."],
  ),
  "xmlTemplate.publishedAt": f(
    ["Tanggal terbit sumber", "Tanggal publikasi berkas resmi DJP."],
    ["Source published", "Publication date of the official DJP file."],
  ),
  "import.companyId": f(
    ["Perusahaan", "Semua baris impor dicatat untuk perusahaan ini."],
    ["Company", "All imported rows are recorded for this company."],
  ),
  "import.file": f(
    [
      "Berkas",
      "CSV atau XLSX, maks. 2 MB, 200 baris, 32 kolom. Formula ditolak.",
    ],
    [
      "File",
      "CSV or XLSX, max 2 MB, 200 rows, 32 columns. Formulas are rejected.",
    ],
  ),
  "import.mapping": f(
    [
      "Pemetaan kolom",
      "Kolom di berkas Anda yang berisi data ini. Kolom wajib bertanda *.",
    ],
    [
      "Column mapping",
      "The column in your file holding this data. Required columns are marked *.",
    ],
  ),
  "import.templateFamily": f(
    ["Jenis templat", "Template CSV/XLSX disesuaikan per jenis bukti potong."],
    ["Template type", "CSV/XLSX templates are tailored per withholding type."],
  ),
  // Export
  "export.companyId": f(
    [
      "Perusahaan pemotong",
      "NPWP dan NITKU perusahaan ini dipakai di berkas XML.",
    ],
    [
      "Withholding company",
      "This company's NPWP and NITKU are used in the XML file.",
    ],
  ),
  "export.taxFamily": f(
    [
      "Jenis bukti potong",
      "Hanya jenis dengan templat DJP terverifikasi yang bisa diekspor.",
    ],
    [
      "Withholding type",
      "Only types with a verified DJP template can be exported.",
    ],
  ),
  "export.taxPeriod": f(
    ["Masa pajak", "Satu berkas XML berisi satu masa pajak."],
    ["Tax period", "One XML file holds one tax period."],
  ),
  "export.outcome": f(
    [
      "Hasil Coretax",
      "Catat tahap terakhir di portal Coretax: diunggah, diterima, atau ditolak.",
    ],
    [
      "Coretax outcome",
      "Record the latest step in the Coretax portal: uploaded, accepted or rejected.",
    ],
  ),
  "export.coretaxReference": f(
    [
      "Nomor referensi Coretax",
      "Nomor tanda terima atau referensi dari Coretax (opsional).",
    ],
    [
      "Coretax reference",
      "Receipt or reference number from Coretax (optional).",
    ],
  ),
  "export.notes": f(
    ["Catatan", "Misalnya alasan penolakan dari Coretax."],
    ["Notes", "For example the rejection reason from Coretax."],
  ),
  "export.fileName": f(
    ["Berkas XML", "Nama berkas berversi; berkas lama tidak pernah ditimpa."],
    ["XML file", "Versioned file name; old files are never overwritten."],
  ),
  "export.version": f(
    ["Versi", "Nomor versi batch dan templat DJP yang dipakai."],
    ["Version", "Batch version and the DJP template used."],
  ),
  "export.itemCount": f(
    ["Jumlah bukti potong", "Banyaknya transaksi dalam berkas."],
    ["Slips", "Number of transactions in the file."],
  ),
  "export.totalDpp": f(
    ["Total DPP", "Jumlah dasar pengenaan pajak seluruh bukti potong."],
    ["Total tax base", "Sum of the tax base of all slips."],
  ),
  "export.totalTax": f(
    ["Total pajak", "Jumlah pajak dipotong seluruh bukti potong."],
    ["Total tax", "Sum of withheld tax of all slips."],
  ),
  "export.xmlSha256": f(
    [
      "Sidik jari berkas",
      "Hash SHA-256 untuk membuktikan berkas tidak berubah.",
    ],
    ["File fingerprint", "SHA-256 hash proving the file is unchanged."],
  ),
  // Tax rule (platform admin)
  "taxRule.code": f(
    ["Kode aturan", "Kode unik aturan pajak (huruf besar)."],
    ["Rule code", "Unique tax rule code (uppercase)."],
  ),
  "taxRule.version": f(
    ["Versi", "Versi aturan; versi baru tidak mengubah snapshot lama."],
    ["Version", "Rule version; new versions never change old snapshots."],
  ),
  "taxRule.name": f(
    ["Nama aturan", "Nama yang mudah dibaca pengguna."],
    ["Rule name", "Human-readable name."],
  ),
  "taxRule.taxFamily": f(
    ["Jenis bukti potong", "Jenis yang dicakup aturan ini."],
    ["Withholding type", "The type covered by this rule."],
  ),
  "taxRule.documentType": f(
    ["Jenis dokumen sumber", "Jenis invoice yang dicakup aturan."],
    ["Source document type", "Invoice type covered by the rule."],
  ),
  "taxRule.objectCode": f(
    ["Kode objek pajak", "Kode objek yang dipilih pengguna saat evaluasi."],
    ["Tax object code", "Object code users pick during evaluation."],
  ),
  "taxRule.rateNumerator": f(
    ["Pembilang tarif", "Contoh: 2 untuk tarif 2%."],
    ["Rate numerator", "Example: 2 for a 2% rate."],
  ),
  "taxRule.rateDenominator": f(
    ["Penyebut tarif", "Contoh: 100 untuk tarif 2%."],
    ["Rate denominator", "Example: 100 for a 2% rate."],
  ),
  "taxRule.roundingMode": f(
    ["Pembulatan", "Cara membulatkan nilai pajak."],
    ["Rounding", "How the tax amount is rounded."],
  ),
  "taxRule.effectiveFrom": f(
    ["Berlaku sejak", "Tanggal dokumen paling awal yang memakai aturan ini."],
    ["Effective from", "Earliest document date using this rule."],
  ),
  "taxRule.effectiveTo": f(
    ["Berlaku sampai", "Kosongkan bila masih berlaku."],
    ["Effective to", "Leave empty while still in force."],
  ),
  "taxRule.sourceCitation": f(
    ["Dasar peraturan", "Rujukan peraturan atau sumber resmi."],
    ["Legal basis", "Regulation or official source reference."],
  ),
  "taxRule.catalogStatus": f(
    [
      "Status aturan",
      "Hanya aturan yang disetujui ahli pajak dipakai untuk produksi.",
    ],
    ["Rule status", "Only expert-approved rules are used in production."],
  ),
  "taxRule.smeReviewedBy": f(
    [
      "Peninjau ahli pajak",
      "Nama ahli pajak yang menyetujui; wajib untuk status disetujui.",
    ],
    [
      "Tax expert reviewer",
      "Name of the approving tax expert; required for approved status.",
    ],
  ),
  "taxRule.requireIdentity": f(
    ["Wajib identitas pajak", "Lawan transaksi harus punya NPWP/NIK/TIN."],
    ["Require tax identity", "Counterparty must have an NPWP/NIK/TIN."],
  ),
  "taxRule.requirePayroll": f(
    ["Wajib bukti penggajian", "Untuk PPh 21."],
    ["Require payroll evidence", "For Art. 21."],
  ),
  "taxRule.requireTreaty": f(
    ["Wajib dokumen traktat", "Untuk PPh 26."],
    ["Require treaty certificate", "For Art. 26."],
  ),
  // XML template (platform admin)
  "xmlTemplate.taxFamily": f(
    ["Jenis bukti potong", "Jenis yang memakai templat ini."],
    ["Withholding type", "The type using this template."],
  ),
  "xmlTemplate.versionTag": f(
    ["Tag versi", "Penanda versi templat DJP."],
    ["Version tag", "DJP template version marker."],
  ),
  "xmlTemplate.sourceUrl": f(
    ["URL sumber resmi", "Alamat unduhan resmi di pajak.go.id."],
    ["Official source URL", "Official download address on pajak.go.id."],
  ),
  "xmlTemplate.sourceLabel": f(
    ["Label sumber", "Nama berkas/sumber DJP."],
    ["Source label", "DJP file/source name."],
  ),
  "xmlTemplate.sourceSha256": f(
    ["Hash berkas sumber", "SHA-256 berkas resmi (64 karakter heks)."],
    ["Source file hash", "SHA-256 of the official file (64 hex chars)."],
  ),
  "xmlTemplate.xsdSchemaHash": f(
    ["Hash skema", "SHA-256 skema XSD kanonik."],
    ["Schema hash", "SHA-256 of the canonical XSD."],
  ),
  "xmlTemplate.fixtureVerified": f(
    [
      "Fixture uji terverifikasi",
      "Contoh berkas sudah dibandingkan dengan konverter resmi.",
    ],
    [
      "Fixture verified",
      "Sample files were compared with the official converter.",
    ],
  ),
  // OCR provider (platform admin)
  "ocrProvider.slug": f(
    [
      "Kode penyedia",
      "Pengenal unik (huruf kecil, tanpa spasi). Tidak bisa diubah.",
    ],
    [
      "Provider code",
      "Unique identifier (lowercase, no spaces). Cannot change.",
    ],
  ),
  "ocrProvider.displayName": f(
    ["Nama penyedia", "Nama yang dilihat pengguna."],
    ["Provider name", "Name shown to users."],
  ),
  "ocrProvider.adapterKey": f(
    ["Jenis adaptor", "Cara SerenTax terhubung ke penyedia."],
    ["Adapter type", "How SerenTax connects to the provider."],
  ),
  "ocrProvider.endpointUrl": f(
    ["URL endpoint", "Alamat HTTPS penyedia (dicek terhadap SSRF)."],
    ["Endpoint URL", "Provider HTTPS address (SSRF-checked)."],
  ),
  "ocrProvider.secretRef": f(
    [
      "Referensi rahasia server",
      "Nama variabel lingkungan berisi kunci API; kuncinya tidak pernah disimpan di basis data.",
    ],
    [
      "Server secret reference",
      "Environment variable holding the API key; the key is never stored in the database.",
    ],
  ),
  "ocrProvider.model": f(
    ["Model", "Nama model OCR penyedia."],
    ["Model", "Provider OCR model name."],
  ),
  "ocrProvider.region": f(
    ["Wilayah data", "Lokasi pemrosesan data."],
    ["Data region", "Where data is processed."],
  ),
  "ocrProvider.maxPages": f(
    ["Maks. halaman", "Batas halaman per dokumen."],
    ["Max pages", "Page limit per document."],
  ),
  "ocrProvider.timeoutMs": f(
    ["Batas waktu (ms)", "Waktu tunggu maksimum per permintaan."],
    ["Timeout (ms)", "Maximum wait per request."],
  ),
  "ocrProvider.monthlyPageCap": f(
    ["Batas halaman bulanan", "Total halaman per bulan per ruang kerja."],
    ["Monthly page cap", "Total pages per month per workspace."],
  ),
  "ocrProvider.monthlySpendCapIdr": f(
    ["Batas biaya bulanan (IDR)", "Biaya maksimum per bulan."],
    ["Monthly spend cap (IDR)", "Maximum monthly spend."],
  ),
  "ocrProvider.estimatedCostPerPageIdr": f(
    ["Perkiraan biaya/halaman (IDR)", "Untuk menghitung batas biaya."],
    ["Estimated cost/page (IDR)", "Used for the spend cap."],
  ),
  "ocrProvider.retentionPolicy": f(
    ["Kebijakan retensi", "Kebijakan penyimpanan data oleh penyedia."],
    ["Retention policy", "Provider data retention policy."],
  ),
  "ocrProvider.processorNotice": f(
    ["Pemberitahuan pemroses", "Informasi pemroses data untuk pengguna."],
    ["Processor notice", "Data processor information for users."],
  ),
  "ocrProvider.vendorApproved": f(
    [
      "Vendor disetujui",
      "Centang hanya setelah perjanjian pemrosesan data, lokasi pemrosesan, dan larangan memakai data pelanggan untuk melatih AI diperiksa.",
    ],
    [
      "Vendor approved",
      "Tick only after the data processing agreement, processing location and the ban on training AI with customer data have been checked.",
    ],
  ),
  "ocrProvider.enabled": f(
    ["Aktif", "Penyedia dapat dipilih oleh ruang kerja."],
    ["Enabled", "Workspaces can choose this provider."],
  ),
  // Account, workspace & team
  "user.name": f(
    ["Nama", "Nama Anda yang terlihat di komentar, riwayat, dan persetujuan."],
    ["Name", "Your name as shown in comments, history and approvals."],
  ),
  "user.email": f(
    ["Email", "Email login dan penerima notifikasi."],
    ["Email", "Login email and notification recipient."],
  ),
  "workspace.name": f(
    [
      "Nama ruang kerja",
      "Nama organisasi yang terlihat di pemilih ruang kerja.",
    ],
    ["Workspace name", "Organisation name shown in the workspace switcher."],
  ),
  "workspace.legalName": f(
    ["Nama badan hukum", "Nama resmi organisasi."],
    ["Legal entity name", "Official organisation name."],
  ),
  "workspace.segregationPolicy": f(
    [
      "Kebijakan persetujuan",
      "Menentukan apakah pembuat boleh menyetujui transaksinya sendiri.",
    ],
    ["Approval policy", "Whether creators may approve their own transactions."],
  ),
  "member.email": f(
    [
      "Email anggota",
      "Undangan dikirim ke email ini dan hanya berlaku untuk email ini (48 jam).",
    ],
    [
      "Member email",
      "The invitation is sent to and only valid for this email (48 hours).",
    ],
  ),
  "member.role": f(
    [
      "Peran",
      "Menentukan apa yang boleh dilakukan anggota. Lihat matriks peran.",
    ],
    ["Role", "Decides what the member may do. See the role matrix."],
  ),
  "support.reason": f(
    ["Alasan akses", "Jelaskan mengapa tim dukungan perlu melihat diagnostik."],
    ["Access reason", "Explain why support needs to see diagnostics."],
  ),
  "support.duration": f(
    ["Durasi (menit)", "15–120 menit; akses berakhir otomatis."],
    ["Duration (minutes)", "15–120 minutes; access ends automatically."],
  ),
  // Subscription
  "billing.licenseKey": f(
    [
      "Kunci lisensi",
      "Kunci dari pembelian paket Berlanggan; disimpan terenkripsi.",
    ],
    [
      "License key",
      "Key from your Berlanggan plan purchase; stored encrypted.",
    ],
  ),
  "billing.plan": f(
    ["Paket", "Paket langganan yang aktif."],
    ["Plan", "The active subscription plan."],
  ),
  "billing.status": f(
    ["Status lisensi", "Kondisi lisensi saat ini."],
    ["License status", "Current license condition."],
  ),
  "billing.monthlyUsage": f(
    [
      "Transaksi bulan ini",
      "Transaksi baru bulan kalender ini (WIB) dibanding batas paket.",
    ],
    [
      "Transactions this month",
      "New transactions this calendar month (WIB) versus the plan limit.",
    ],
  ),
  "billing.validUntil": f(
    [
      "Berlaku hingga",
      "Tanggal lisensi berakhir; perpanjang sebelum tanggal ini.",
    ],
    ["Valid until", "When the license ends; renew before this date."],
  ),
  "billing.lastValidatedAt": f(
    [
      "Terakhir dicek",
      "Kapan SerenTax terakhir memverifikasi lisensi ke penyedia.",
    ],
    [
      "Last checked",
      "When SerenTax last verified the license with the provider.",
    ],
  ),
  "billing.lastProblem": f(
    ["Masalah terakhir", "Kendala terakhir saat memverifikasi lisensi."],
    ["Last problem", "The last issue when verifying the license."],
  ),
  "billing.fingerprint": f(
    [
      "Sidik jari instans",
      "Pengenal instalasi/ruang kerja untuk aktivasi lisensi (opsional).",
    ],
    [
      "Instance fingerprint",
      "Installation/workspace identifier for license activation (optional).",
    ],
  ),
  "billing.adapterMode": f(
    [
      "Mode penagihan",
      "Sumber lisensi: tidak aktif, uji sintetis, atau Berlanggan produksi.",
    ],
    [
      "Billing mode",
      "License source: off, synthetic test, or live Berlanggan.",
    ],
  ),
  "billing.apiBaseUrl": f(
    ["URL API Berlanggan", "Alamat HTTPS API penyedia lisensi."],
    ["Berlanggan API URL", "HTTPS address of the licensing API."],
  ),
  "billing.productSlug": f(
    ["Kode produk", "Kode produk SerenTax di katalog penjual Berlanggan."],
    ["Product code", "SerenTax product code in the Berlanggan seller catalog."],
  ),
  "billing.storefrontUrl": f(
    ["URL toko", "Halaman pembelian resmi yang ditampilkan ke pelanggan."],
    ["Storefront URL", "Official purchase page shown to customers."],
  ),
  "billing.productSecretRef": f(
    [
      "Variabel rahasia produk",
      "Nama variabel lingkungan server yang berisi rahasia produk; nilainya tidak disimpan di basis data.",
    ],
    [
      "Product secret variable",
      "Server environment variable holding the product secret; the value is never stored in the database.",
    ],
  ),
  "billing.webhookSecretRef": f(
    [
      "Variabel rahasia webhook",
      "Nama variabel lingkungan untuk memverifikasi tanda tangan webhook.",
    ],
    [
      "Webhook secret variable",
      "Environment variable used to verify webhook signatures.",
    ],
  ),
  "billing.ed25519Key": f(
    [
      "Kunci publik verifikasi",
      "Kunci publik untuk memverifikasi tanda tangan data lisensi.",
    ],
    [
      "Verification public key",
      "Public key used to verify signed license data.",
    ],
  ),
  "billing.compatibilityNote": f(
    [
      "Catatan kompatibilitas",
      "Bukti/catatan persetujuan penyedia untuk model SaaS.",
    ],
    ["Compatibility notes", "Evidence/notes of the provider's SaaS approval."],
  ),
  "auth.email": f(
    [
      "Email",
      "Email yang Anda pakai untuk masuk; tautan verifikasi dikirim ke sini.",
    ],
    ["Email", "The email you sign in with; verification links are sent here."],
  ),
  "auth.password": f(
    [
      "Kata sandi",
      "12–128 karakter. Jangan gunakan ulang kata sandi dari layanan lain.",
    ],
    [
      "Password",
      "12–128 characters. Do not reuse passwords from other services.",
    ],
  ),
  "ocr.document": f(
    ["Dokumen", "Berkas sumber yang dibaca OCR."],
    ["Document", "The source file read by OCR."],
  ),
  "ocr.invoiceNumber": f(
    ["Nomor faktur (OCR)", "Nomor faktur hasil baca OCR; koreksi bila salah."],
    [
      "Invoice number (OCR)",
      "Invoice number read by OCR; correct it if wrong.",
    ],
  ),
  "ocr.documentDate": f(
    ["Tanggal dokumen (OCR)", "Tanggal hasil baca OCR."],
    ["Document date (OCR)", "Date read by OCR."],
  ),
  "ocr.taxPeriod": f(
    ["Masa pajak (OCR)", "Masa pajak hasil baca OCR (YYYY-MM)."],
    ["Tax period (OCR)", "Tax period read by OCR (YYYY-MM)."],
  ),
  "ocr.counterpartyIdentity": f(
    ["Identitas lawan transaksi (OCR)", "NPWP/NIK hasil baca OCR."],
    ["Counterparty identity (OCR)", "Tax ID read by OCR."],
  ),
  "ocr.lineDescription": f(
    ["Uraian baris (OCR)", "Uraian barang/jasa hasil baca OCR."],
    ["Line description (OCR)", "Goods/service description read by OCR."],
  ),
  "ocr.quantity": f(
    ["Jumlah (OCR)", "Kuantitas hasil baca OCR."],
    ["Quantity (OCR)", "Quantity read by OCR."],
  ),
  "ocr.unitPrice": f(
    ["Harga satuan (OCR)", "Harga satuan hasil baca OCR."],
    ["Unit price (OCR)", "Unit price read by OCR."],
  ),
  "admin.inspectReason": f(
    ["Alasan inspeksi", "Wajib; tercatat di log audit ruang kerja."],
    ["Inspection reason", "Required; recorded in the workspace audit log."],
  ),
  "admin.jobStatus": f(
    ["Status pekerjaan", "Saring pekerjaan OCR berdasarkan status."],
    ["Job status", "Filter OCR jobs by status."],
  ),
  "lead.companyName": f(
    ["Nama perusahaan", "Nama badan usaha yang akan memakai SerenTax."],
    ["Company name", "The business that will use SerenTax."],
  ),
  "lead.picName": f(
    ["Nama PIC", "Orang yang kami hubungi untuk pendaftaran ini."],
    ["Person in charge", "The person we contact about this registration."],
  ),
  "lead.email": f(
    ["Email PIC", "Kami mengirim tindak lanjut ke email ini."],
    ["PIC email", "We send the follow-up to this email."],
  ),
  "lead.phone": f(
    ["Nomor telepon", "Nomor yang bisa dihubungi, misalnya +62 812 xxxx xxxx."],
    ["Phone number", "A reachable number, e.g. +62 812 xxxx xxxx."],
  ),
  "lead.npwp": f(
    ["NPWP perusahaan (opsional)", "15 atau 16 digit; disimpan terenkripsi."],
    ["Company tax ID / NPWP (optional)", "15 or 16 digits; stored encrypted."],
  ),
  "lead.estimatedMonthlyInvoices": f(
    [
      "Perkiraan faktur per bulan",
      "Membantu kami menyiapkan penawaran harga per faktur.",
    ],
    [
      "Estimated invoices per month",
      "Helps us prepare a per-invoice price offer.",
    ],
  ),
  "lead.message": f(
    [
      "Kebutuhan Anda (opsional)",
      "Ceritakan proses pajak saat ini atau jenis pajak yang diproses.",
    ],
    [
      "Your needs (optional)",
      "Describe your current tax process or the tax types you handle.",
    ],
  ),
  "lead.status": f(
    ["Status tindak lanjut", "Tahap penanganan prospek oleh tim sales."],
    ["Follow-up status", "Where the sales team is with this lead."],
  ),
  "lead.notes": f(
    ["Catatan internal", "Hanya terlihat oleh superadmin."],
    ["Internal notes", "Visible to superadmins only."],
  ),
  "offer.pricingModel": f(
    [
      "Model harga",
      "Langganan (kuota paket) atau per faktur (dihitung per faktur yang diproses).",
    ],
    [
      "Pricing model",
      "Subscription (plan quota) or per invoice (charged per processed invoice).",
    ],
  ),
  "offer.pricePerInvoiceIdr": f(
    ["Harga per faktur (IDR)", "Sesuai surat penawaran; belum termasuk pajak."],
    ["Price per invoice (IDR)", "As in the offer letter; excludes tax."],
  ),
  "offer.minimumMonthlyIdr": f(
    [
      "Minimum bulanan (IDR)",
      "Tagihan minimum per bulan; isi 0 bila tidak ada.",
    ],
    ["Monthly minimum (IDR)", "Minimum monthly charge; 0 when none."],
  ),
  "offer.monthlyInvoiceCap": f(
    [
      "Batas faktur per bulan",
      "Opsional; transaksi baru ditolak setelah batas tercapai. Kosongkan untuk tanpa batas.",
    ],
    [
      "Monthly invoice cap",
      "Optional; new transactions are refused once reached. Leave empty for no cap.",
    ],
  ),
  "offer.offerReference": f(
    [
      "Nomor surat penawaran",
      "Referensi dokumen penawaran yang disetujui pelanggan.",
    ],
    [
      "Offer letter reference",
      "Reference of the offer document the customer accepted.",
    ],
  ),
  "offer.effectiveFrom": f(
    ["Berlaku mulai", "Tanggal mulai penawaran (WIB)."],
    ["Effective from", "Offer start date (WIB)."],
  ),
  "offer.effectiveTo": f(
    ["Berlaku sampai", "Opsional; kosongkan bila tanpa batas waktu."],
    ["Effective to", "Optional; leave empty when open-ended."],
  ),
  "offer.active": f(
    ["Aktif", "Nonaktifkan untuk menghentikan penagihan per faktur sementara."],
    ["Active", "Turn off to pause per-invoice billing."],
  ),
  "offer.vatRatePercent": f(
    [
      "Tarif PPN invoice (%)",
      "Sesuai surat penawaran dan ketentuan pajak penjual; isi 0 bila tidak dipungut.",
    ],
    [
      "Invoice VAT rate (%)",
      "As in the offer letter and the seller's tax position; 0 when not charged.",
    ],
  ),
  "offer.paymentTermDays": f(
    [
      "Jatuh tempo (hari)",
      "Jumlah hari sejak invoice diterbitkan sampai jatuh tempo.",
    ],
    ["Payment term (days)", "Days from issue date until the invoice is due."],
  ),
  "offer.notes": f(
    ["Catatan", "Catatan internal tentang penawaran ini."],
    ["Notes", "Internal notes about this offer."],
  ),
  "termination.reason": f(
    ["Alasan berhenti (opsional)", "Membantu kami memperbaiki layanan."],
    ["Reason for leaving (optional)", "Helps us improve the service."],
  ),
  "invoice.period": f(
    ["Periode tagihan", "Bulan pemakaian yang ditagih (YYYY-MM, WIB)."],
    ["Billing period", "Usage month being billed (YYYY-MM, WIB)."],
  ),
  "invoice.paymentLink": f(
    [
      "Tautan pembayaran (opsional)",
      "Tautan dari payment gateway Anda (HTTPS). Kosongkan bila hanya transfer bank.",
    ],
    [
      "Payment link (optional)",
      "A link from your payment gateway (HTTPS). Leave empty for bank transfer only.",
    ],
  ),
  "invoice.paidOn": f(
    ["Tanggal dibayar", "Tanggal dana diterima."],
    ["Paid on", "Date the funds were received."],
  ),
  "invoice.paymentMethod": f(
    ["Metode pembayaran", "Misalnya transfer bank atau nama payment gateway."],
    [
      "Payment method",
      "For example bank transfer or the payment gateway name.",
    ],
  ),
  "invoice.paymentReference": f(
    ["Referensi pembayaran", "Nomor bukti transfer atau ID transaksi gateway."],
    ["Payment reference", "Transfer receipt number or gateway transaction ID."],
  ),
  "invoice.voidReason": f(
    ["Alasan pembatalan", "Wajib; tercatat di log audit."],
    ["Void reason", "Required; recorded in the audit log."],
  ),
  "lifecycle.workspace": f(
    ["Ruang kerja", "Ruang kerja yang langganannya diakhiri."],
    ["Workspace", "The workspace whose subscription is ended."],
  ),
  "lifecycle.reason": f(
    [
      "Alasan",
      "Misalnya kontrak selesai atau tunggakan pembayaran. Tercatat di log audit.",
    ],
    [
      "Reason",
      "For example contract ended or unpaid invoices. Recorded in the audit log.",
    ],
  ),
  "ocr.provider": f(
    ["Penyedia OCR", "Penyedia yang dipakai untuk membaca dokumen."],
    ["OCR provider", "The provider used to read documents."],
  ),
  "ocr.consent": f(
    [
      "Persetujuan pemrosesan AI",
      "Izin mengirim dokumen ke penyedia AI eksternal.",
    ],
    [
      "AI processing consent",
      "Permission to send documents to the external AI provider.",
    ],
  ),
} as const;

export type FieldKey = keyof typeof fieldDictionary;

export function fieldInfo(locale: Locale, key: FieldKey) {
  const entry = fieldDictionary[key] as Entry;
  const [label, help] = entry[locale];
  return { label, help, technical: key };
}
