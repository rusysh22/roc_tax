import type { Locale } from "./messages";
/** Semantic badge tones (match Badge tones in components/ui/status.tsx). */
export type BadgeTone = "gray" | "blue" | "green" | "amber" | "red" | "violet";

/**
 * Code registry — the ONLY place where technical codes (enum values) get a
 * user-facing name. Every code has a functional label, a plain-language
 * explanation (shown in the info tooltip together with the technical code)
 * and a semantic colour. UI must never print a raw code; use <CodeBadge> or
 * codeLabel(). A unit test (tests/unit/ui-standards.test.ts) enforces that
 * every enum value is covered here and that labels contain no raw codes.
 */
export type CodeEntry = { tone: BadgeTone; label: string; help: string };
type Bilingual = {
  tone: BadgeTone;
  id: [string, string];
  en: [string, string];
};
const c = (
  tone: BadgeTone,
  id: [string, string],
  en: [string, string],
): Bilingual => ({ tone, id, en });

export const codeRegistry = {
  transactionStatus: {
    DRAFT: c(
      "gray",
      [
        "Draf",
        "Baru dibuat dan masih bisa diubah. Langkah berikutnya: evaluasi aturan pajak.",
      ],
      [
        "Draft",
        "Newly created and still editable. Next step: evaluate the tax rule.",
      ],
    ),
    EXTRACTING: c(
      "blue",
      ["Mengekstrak", "OCR sedang membaca dokumen sumber."],
      ["Extracting", "OCR is reading the source document."],
    ),
    NEEDS_REVIEW: c(
      "amber",
      [
        "Perlu tinjauan",
        "Isian perlu diperiksa manusia (misalnya hasil OCR) sebelum dievaluasi.",
      ],
      [
        "Needs review",
        "Fields need human checking (e.g. OCR results) before evaluation.",
      ],
    ),
    VALIDATED: c(
      "blue",
      [
        "Tervalidasi",
        "Evaluasi pajak lolos tanpa penghambat. Siap diajukan oleh Penyusun.",
      ],
      [
        "Validated",
        "Tax evaluation passed with no blockers. Ready to be submitted by the Preparer.",
      ],
    ),
    SUBMITTED: c(
      "amber",
      [
        "Menunggu persetujuan",
        "Sudah diajukan dan menunggu Pemberi persetujuan.",
      ],
      ["Awaiting approval", "Submitted and waiting for the Approver."],
    ),
    CHANGES_REQUESTED: c(
      "red",
      [
        "Perlu perbaikan",
        "Dikembalikan oleh Peninjau/Pemberi persetujuan dengan alasan. Perbaiki lalu evaluasi ulang.",
      ],
      [
        "Changes requested",
        "Sent back by the Reviewer/Approver with a reason. Fix and re-evaluate.",
      ],
    ),
    APPROVED: c(
      "green",
      ["Disetujui", "Snapshot pajak terkunci. Siap dimasukkan ke batch XML."],
      ["Approved", "Tax snapshot locked. Ready for an XML batch."],
    ),
    EXPORTED: c(
      "violet",
      [
        "Diekspor",
        "Sudah masuk berkas XML. Unggah ke Coretax lalu catat hasilnya.",
      ],
      [
        "Exported",
        "Included in an XML file. Upload it to Coretax and record the outcome.",
      ],
    ),
    CORETAX_ACCEPTED: c(
      "green",
      [
        "Diterima Coretax",
        "Dicatat diterima oleh Coretax (pencatatan manual oleh pengguna).",
      ],
      [
        "Accepted by Coretax",
        "Recorded as accepted by Coretax (entered manually by a user).",
      ],
    ),
    CORETAX_REJECTED: c(
      "red",
      [
        "Ditolak Coretax",
        "Dicatat ditolak oleh Coretax. Buka kembali, perbaiki, lalu ekspor ulang.",
      ],
      [
        "Rejected by Coretax",
        "Recorded as rejected by Coretax. Reopen, fix and export again.",
      ],
    ),
    VOIDED: c(
      "gray",
      [
        "Dibatalkan",
        "Tidak berlaku lagi; riwayatnya tetap disimpan. Kuota tidak dikembalikan.",
      ],
      ["Voided", "No longer valid; history is kept. Quota is not refunded."],
    ),
  },
  coretaxOutcome: {
    NONE: c(
      "violet",
      [
        "XML dibuat",
        "Berkas XML sudah dibuat tetapi belum dicatat diunggah ke Coretax.",
      ],
      [
        "XML created",
        "The XML file exists but has not been recorded as uploaded to Coretax.",
      ],
    ),
    CORETAX_SUBMITTED: c(
      "amber",
      [
        "Diunggah ke Coretax",
        "Berkas sudah diunggah manual ke Coretax; menunggu hasil pemrosesan.",
      ],
      [
        "Uploaded to Coretax",
        "The file was uploaded to Coretax manually; waiting for the result.",
      ],
    ),
    CORETAX_ACCEPTED: c(
      "green",
      ["Diterima Coretax", "Coretax menerima berkas ini (dicatat manual)."],
      [
        "Accepted by Coretax",
        "Coretax accepted this file (recorded manually).",
      ],
    ),
    CORETAX_REJECTED: c(
      "red",
      [
        "Ditolak Coretax",
        "Coretax menolak berkas ini. Buka kembali transaksinya dan buat batch baru.",
      ],
      [
        "Rejected by Coretax",
        "Coretax rejected this file. Reopen the transactions and create a new batch.",
      ],
    ),
  },
  taxFamily: {
    UNCLASSIFIED: c(
      "gray",
      [
        "Belum diklasifikasi",
        "Draf netral; pilih jenis bukti potong sebelum evaluasi pajak.",
      ],
      [
        "Unclassified",
        "Neutral draft; choose the withholding type before tax evaluation.",
      ],
    ),
    PPH_UNIFIKASI_BPPU: c(
      "blue",
      [
        "BPPU · PPh Unifikasi",
        "Bukti potong PPh Unifikasi untuk penerima dalam negeri (PPh 4(2), 15, 22, 23). Ekspor XML tersedia.",
      ],
      [
        "BPPU · Unified withholding",
        "Unified income-tax withholding slip for domestic payees (Art. 4(2), 15, 22, 23). XML export available.",
      ],
    ),
    PPN_FAKTUR_KELUARAN: c(
      "amber",
      [
        "Faktur keluaran · PPN",
        "Faktur pajak keluaran PPN. Templat XML belum terverifikasi.",
      ],
      [
        "Output VAT invoice",
        "Output VAT invoice. XML template not verified yet.",
      ],
    ),
    PPH_UNIFIKASI_BPNR: c(
      "amber",
      [
        "BPNR · PPh Unifikasi",
        "Bukti potong untuk penerima non-residen. Belum didukung untuk ekspor.",
      ],
      [
        "BPNR · Unified (non-resident)",
        "Withholding slip for non-resident payees. Export not supported yet.",
      ],
    ),
    PPH21_BP21: c(
      "gray",
      [
        "BP21 · PPh 21",
        "PPh 21 bukan pegawai tetap; memerlukan data penggajian.",
      ],
      [
        "BP21 · Art. 21",
        "Art. 21 for non-permanent recipients; needs payroll data.",
      ],
    ),
    PPH21_BPMP: c(
      "gray",
      [
        "BPMP · PPh 21",
        "PPh 21 bulanan pegawai tetap; memerlukan data penggajian.",
      ],
      [
        "BPMP · Art. 21",
        "Monthly Art. 21 for permanent employees; needs payroll data.",
      ],
    ),
    PPH21_BPA1: c(
      "gray",
      ["BPA1 · PPh 21", "Bukti potong tahunan A1; memerlukan data penggajian."],
      ["BPA1 · Art. 21", "Annual A1 slip; needs payroll data."],
    ),
    PPH21_BPA2: c(
      "gray",
      [
        "BPA2 · PPh 21",
        "Bukti potong tahunan A2 (ASN); memerlukan data penggajian.",
      ],
      [
        "BPA2 · Art. 21",
        "Annual A2 slip (civil servants); needs payroll data.",
      ],
    ),
    PPH26_BP26: c(
      "gray",
      [
        "BP26 · PPh 26",
        "PPh 26 untuk wajib pajak luar negeri; memerlukan dokumen traktat/SKD.",
      ],
      [
        "BP26 · Art. 26",
        "Art. 26 for foreign taxpayers; needs a treaty certificate.",
      ],
    ),
  },
  templateAvailability: {
    AVAILABLE: c(
      "green",
      [
        "Tersedia",
        "Templat XML resmi DJP sudah terverifikasi; ekspor bisa dibuat.",
      ],
      [
        "Available",
        "The official DJP XML template is verified; exports can be created.",
      ],
    ),
    TEMPLATE_UNVERIFIED: c(
      "red",
      [
        "Belum tersedia",
        "Templat XML resmi DJP untuk jenis ini belum terverifikasi, jadi ekspor diblokir.",
      ],
      [
        "Not available",
        "The official DJP XML template for this type is not verified, so export is blocked.",
      ],
    ),
  },
  xmlTemplateStatus: {
    UNVERIFIED: c(
      "amber",
      [
        "Belum diverifikasi",
        "Terdaftar tetapi belum diverifikasi; belum bisa dipakai ekspor.",
      ],
      [
        "Not verified",
        "Registered but not verified; cannot be used for exports yet.",
      ],
    ),
    VERIFIED: c(
      "green",
      [
        "Terverifikasi",
        "Sumber, hash, dan fixture uji sudah diverifikasi; dipakai untuk ekspor.",
      ],
      [
        "Verified",
        "Source, hash and fixture tests verified; used for exports.",
      ],
    ),
    RETIRED: c(
      "gray",
      [
        "Dihentikan",
        "Tidak dipakai lagi untuk ekspor baru; riwayat tetap ada.",
      ],
      ["Retired", "No longer used for new exports; history is kept."],
    ),
  },
  taxRuleStatus: {
    DRAFT: c(
      "gray",
      ["Draf", "Belum ditinjau; tidak dipakai untuk evaluasi."],
      ["Draft", "Not reviewed; not used for evaluation."],
    ),
    NON_PRODUCTION_TEST: c(
      "amber",
      [
        "Uji (non-produksi)",
        "Hanya untuk pratinjau; transaksi dengan aturan ini tidak bisa diajukan atau diekspor.",
      ],
      [
        "Test (non-production)",
        "Preview only; transactions using it cannot be submitted or exported.",
      ],
    ),
    SME_APPROVED: c(
      "green",
      [
        "Disetujui ahli pajak",
        "Disetujui ahli pajak (SME) dan dipakai untuk transaksi produksi.",
      ],
      [
        "Approved by tax expert",
        "Approved by a tax expert (SME) and used for production transactions.",
      ],
    ),
    RETIRED: c(
      "gray",
      [
        "Dihentikan",
        "Tidak dipakai untuk evaluasi baru; snapshot lama tetap tersimpan.",
      ],
      ["Retired", "Not used for new evaluations; old snapshots are kept."],
    ),
  },
  role: {
    OWNER: c(
      "violet",
      [
        "Pemilik",
        "Mengelola tim, perusahaan, langganan, dan kebijakan. Tidak otomatis menyusun atau menyetujui transaksi.",
      ],
      [
        "Owner",
        "Manages team, companies, subscription and policies. Does not prepare or approve transactions by default.",
      ],
    ),
    ADMIN: c(
      "blue",
      [
        "Admin",
        "Seperti Pemilik, tetapi tidak dapat mengangkat Pemilik/Admin lain.",
      ],
      ["Admin", "Like an Owner, but cannot appoint other Owners/Admins."],
    ),
    PREPARER: c(
      "gray",
      [
        "Penyusun",
        "Membuat dan mengubah draf, impor, evaluasi pajak, mengajukan, dan membuat XML.",
      ],
      [
        "Preparer",
        "Creates and edits drafts, imports, evaluates tax, submits and creates XML.",
      ],
    ),
    REVIEWER: c(
      "amber",
      [
        "Peninjau",
        "Meninjau, mengevaluasi, meminta perbaikan, dan membuka kembali transaksi.",
      ],
      [
        "Reviewer",
        "Reviews, evaluates, requests changes and reopens transactions.",
      ],
    ),
    APPROVER: c(
      "green",
      [
        "Pemberi persetujuan",
        "Menyetujui transaksi dan mengunci snapshot pajak.",
      ],
      ["Approver", "Approves transactions and locks the tax snapshot."],
    ),
  },
  permission: {
    "team.manage": c(
      "violet",
      [
        "Kelola tim & data perusahaan",
        "Undang anggota, ubah peran, kelola perusahaan, langganan, OCR, dan kebijakan persetujuan.",
      ],
      [
        "Manage team & company data",
        "Invite members, change roles, manage companies, subscription, OCR and approval policy.",
      ],
    ),
    "draft.prepare": c(
      "blue",
      [
        "Siapkan transaksi",
        "Buat/ubah/batalkan draf, impor spreadsheet, lampirkan dokumen, dan ajukan untuk tinjauan.",
      ],
      [
        "Prepare transactions",
        "Create/edit/void drafts, import spreadsheets, attach documents and submit for review.",
      ],
    ),
    "tax.review": c(
      "amber",
      [
        "Tinjau transaksi",
        "Evaluasi pajak, minta perbaikan, dan buka kembali transaksi yang disetujui.",
      ],
      [
        "Review transactions",
        "Evaluate tax, request changes and reopen approved transactions.",
      ],
    ),
    "tax.approve": c(
      "green",
      [
        "Setujui transaksi",
        "Setujui transaksi yang diajukan dan kunci snapshot pajak.",
      ],
      [
        "Approve transactions",
        "Approve submitted transactions and lock the tax snapshot.",
      ],
    ),
    "tax.export": c(
      "violet",
      [
        "Ekspor XML & catat Coretax",
        "Buat berkas XML BPPU dan catat hasil unggah Coretax.",
      ],
      [
        "Export XML & record Coretax",
        "Create BPPU XML files and record Coretax outcomes.",
      ],
    ),
  },
  segregationPolicy: {
    STRICT_SEPARATION: c(
      "green",
      [
        "Pemisahan ketat (disarankan)",
        "Pembuat, pengaju, atau peninjau tidak dapat menyetujui transaksinya sendiri.",
      ],
      [
        "Strict separation (recommended)",
        "The creator, submitter or reviewer cannot approve their own transaction.",
      ],
    ),
    SOLE_USER_EXCEPTION: c(
      "amber",
      [
        "Pengecualian pengguna tunggal",
        "Persetujuan sendiri diizinkan dengan peringatan dan konfirmasi; tercatat di log audit.",
      ],
      [
        "Sole-user exception",
        "Self-approval allowed with a warning and confirmation; recorded in the audit log.",
      ],
    ),
  },
  discrepancy: {
    NONE: c(
      "green",
      [
        "Selesai",
        "Nilai sumber, snapshot, XML, dan hasil Coretax sudah sinkron.",
      ],
      ["Complete", "Source, snapshot, XML and Coretax outcome are in sync."],
    ),
    NOT_EVALUATED: c(
      "gray",
      ["Belum dievaluasi", "Pajak belum dievaluasi untuk transaksi ini."],
      ["Not evaluated", "Tax has not been evaluated for this transaction."],
    ),
    HAS_BLOCKERS: c(
      "red",
      [
        "Ada penghambat",
        "Evaluasi terakhir masih memiliki penghambat validasi.",
      ],
      ["Has blockers", "The latest evaluation still has validation blockers."],
    ),
    UNAPPROVED_DRAFT: c(
      "amber",
      ["Belum disetujui", "Transaksi belum disetujui."],
      ["Not approved", "The transaction is not approved yet."],
    ),
    EXPORT_PENDING: c(
      "blue",
      ["Siap diekspor", "Disetujui tetapi belum dimasukkan ke berkas XML."],
      ["Ready to export", "Approved but not included in an XML file yet."],
    ),
    OUTCOME_UNRECORDED: c(
      "violet",
      [
        "Hasil Coretax belum dicatat",
        "XML sudah dibuat; catat hasil unggah Coretax.",
      ],
      [
        "Coretax outcome missing",
        "XML created; record the Coretax upload outcome.",
      ],
    ),
    CORETAX_REJECTED: c(
      "red",
      ["Ditolak Coretax", "Perlu dibuka kembali dan diperbaiki."],
      ["Rejected by Coretax", "Needs to be reopened and fixed."],
    ),
    REOPENED_AFTER_EXPORT: c(
      "amber",
      [
        "Dibuka kembali",
        "Dibuka kembali setelah XML dibuat; perlu ekspor ulang.",
      ],
      ["Reopened", "Reopened after export; needs a new export."],
    ),
    VOIDED: c(
      "gray",
      ["Dibatalkan", "Transaksi dibatalkan."],
      ["Voided", "The transaction was voided."],
    ),
  },
  source: {
    MANUAL: c(
      "gray",
      ["Manual", "Diinput manual melalui form."],
      ["Manual", "Entered manually in the form."],
    ),
    SPREADSHEET: c(
      "blue",
      ["Impor spreadsheet", "Dibuat dari impor CSV/XLSX."],
      ["Spreadsheet import", "Created from a CSV/XLSX import."],
    ),
    OCR: c(
      "violet",
      [
        "OCR",
        "Isian diusulkan dari dokumen melalui OCR dan diperiksa pengguna.",
      ],
      [
        "OCR",
        "Fields suggested from a document via OCR and checked by a user.",
      ],
    ),
    ERP: c(
      "gray",
      ["ERP", "Diambil dari sistem ERP."],
      ["ERP", "Taken from an ERP system."],
    ),
  },
  billingMode: {
    NOT_CONFIGURED: c(
      "gray",
      [
        "Belum dikonfigurasi",
        "Penagihan belum diatur; hanya uji coba akun yang berlaku.",
      ],
      [
        "Not configured",
        "Billing is not set up; only the account trial applies.",
      ],
    ),
    SYNTHETIC_TEST: c(
      "amber",
      [
        "Mode uji",
        "Lisensi sintetis untuk pengujian; tidak untuk penggunaan produksi.",
      ],
      ["Test mode", "Synthetic licenses for testing; not for production use."],
    ),
    BERLANGGAN_LIVE: c(
      "green",
      ["Berlanggan (produksi)", "Terhubung ke penyedia lisensi Berlanggan."],
      ["Berlanggan (live)", "Connected to the Berlanggan licensing provider."],
    ),
  },
  licenseStatus: {
    NOT_CONFIGURED: c(
      "gray",
      ["Belum aktif", "Belum ada lisensi untuk ruang kerja ini."],
      ["Not active", "No license for this workspace yet."],
    ),
    ACTIVE: c(
      "green",
      ["Aktif", "Lisensi aktif; kuota paket berlaku."],
      ["Active", "License active; plan quota applies."],
    ),
    GRACE: c(
      "amber",
      [
        "Masa tenggang",
        "Lisensi melewati jatuh tempo tetapi masih dalam masa tenggang.",
      ],
      ["Grace period", "Past due but still within the grace period."],
    ),
    EXPIRED: c(
      "red",
      ["Kedaluwarsa", "Lisensi sudah berakhir; perpanjang langganan."],
      ["Expired", "The license has ended; renew the subscription."],
    ),
    SUSPENDED: c(
      "red",
      ["Ditangguhkan", "Lisensi ditangguhkan oleh penyedia."],
      ["Suspended", "The provider suspended the license."],
    ),
    REVOKED: c(
      "red",
      ["Dicabut", "Lisensi dicabut atau dinonaktifkan."],
      ["Revoked", "The license was revoked or deactivated."],
    ),
    INVALID: c(
      "red",
      [
        "Tidak valid",
        "Kunci lisensi tidak dikenali atau tanda tangan tidak sah.",
      ],
      ["Invalid", "Unknown license key or invalid signature."],
    ),
    SEAT_FULL: c(
      "amber",
      ["Kuota pengguna penuh", "Jumlah aktivasi lisensi sudah mencapai batas."],
      ["Seats full", "The license activation limit is reached."],
    ),
    RATE_LIMITED: c(
      "amber",
      ["Terlalu sering", "Terlalu banyak permintaan; coba lagi nanti."],
      ["Rate limited", "Too many requests; try again later."],
    ),
    COMPATIBILITY_BLOCKED: c(
      "amber",
      [
        "Menunggu konfirmasi penyedia",
        "Paket berbayar belum dibuka sampai penyedia lisensi mengonfirmasi dukungan SaaS.",
      ],
      [
        "Awaiting provider",
        "Paid plans stay closed until the licensing provider confirms SaaS support.",
      ],
    ),
  },
  ocrAdapter: {
    NONE: c(
      "gray",
      ["Tanpa OCR", "Input manual dan spreadsheet saja."],
      ["No OCR", "Manual and spreadsheet entry only."],
    ),
    SYNTHETIC_TEST: c(
      "amber",
      ["OCR uji lokal", "Penyedia uji tanpa jaringan; hanya untuk pengujian."],
      ["Local test OCR", "Offline test provider; for testing only."],
    ),
    EXTERNAL_NOT_CONFIGURED: c(
      "red",
      [
        "OCR eksternal (belum siap)",
        "Penyedia eksternal belum dikonfigurasi; permintaan ditolak.",
      ],
      [
        "External OCR (not ready)",
        "External provider not configured; requests are refused.",
      ],
    ),
    ANTHROPIC_CLAUDE: c(
      "violet",
      [
        "Claude (Anthropic)",
        "Model AI Claude membaca PDF/gambar faktur lewat API Anthropic.",
      ],
      [
        "Claude (Anthropic)",
        "Claude reads invoice PDFs/images through the Anthropic API.",
      ],
    ),
    AWS_BEDROCK_CLAUDE: c(
      "violet",
      [
        "Claude via AWS Bedrock",
        "Claude lewat akun AWS sendiri; region bisa dipilih (misalnya Asia/Jakarta bila tersedia).",
      ],
      [
        "Claude via AWS Bedrock",
        "Claude through your own AWS account; region is configurable (e.g. Asia/Jakarta when available).",
      ],
    ),
    AWS_TEXTRACT: c(
      "blue",
      [
        "AWS Textract",
        "Layanan OCR faktur AWS (Analyze Expense) di akun AWS sendiri.",
      ],
      [
        "AWS Textract",
        "AWS invoice OCR (Analyze Expense) in your own AWS account.",
      ],
    ),
    GOOGLE_DOCUMENT_AI: c(
      "blue",
      ["Google Document AI", "Processor Invoice Parser Google Cloud."],
      ["Google Document AI", "Google Cloud Invoice Parser processor."],
    ),
    OPENAI_COMPATIBLE: c(
      "blue",
      [
        "Endpoint kompatibel OpenAI",
        "Model AI lain lewat endpoint chat-completions yang kompatibel (gambar saja).",
      ],
      [
        "OpenAI-compatible endpoint",
        "Other AI models through a compatible chat-completions endpoint (images only).",
      ],
    ),
    GENERIC_HTTP: c(
      "gray",
      [
        "HTTP generik",
        "Layanan OCR milik sendiri/vendor lokal yang mengikuti kontrak JSON SerenTax.",
      ],
      [
        "Generic HTTP",
        "Your own or a regional OCR service following the SerenTax JSON contract.",
      ],
    ),
  },
  ocrJobStatus: {
    QUEUED: c(
      "gray",
      ["Antre", "Menunggu diproses."],
      ["Queued", "Waiting to be processed."],
    ),
    RUNNING: c(
      "blue",
      ["Berjalan", "Sedang diproses."],
      ["Running", "Being processed."],
    ),
    SUCCEEDED: c(
      "green",
      ["Berhasil", "Selesai diproses."],
      ["Succeeded", "Processed successfully."],
    ),
    FAILED_RETRYABLE: c(
      "amber",
      [
        "Gagal, akan dicoba ulang",
        "Gagal sementara; akan dicoba ulang otomatis.",
      ],
      ["Failed, will retry", "Temporary failure; retried automatically."],
    ),
    DEAD_LETTER: c(
      "red",
      [
        "Gagal permanen",
        "Gagal setelah beberapa percobaan; lanjutkan secara manual.",
      ],
      [
        "Failed permanently",
        "Failed after several attempts; continue manually.",
      ],
    ),
    CANCELLED: c(
      "gray",
      ["Dibatalkan", "Dibatalkan."],
      ["Cancelled", "Cancelled."],
    ),
  },
  supportAccess: {
    ACTIVE: c(
      "amber",
      [
        "Aktif",
        "Tim dukungan dapat melihat diagnostik sampai izin berakhir atau dicabut.",
      ],
      [
        "Active",
        "Support can view diagnostics until the grant expires or is revoked.",
      ],
    ),
    REVOKED: c(
      "gray",
      ["Dicabut", "Izin akses dukungan sudah dicabut."],
      ["Revoked", "The support access grant was revoked."],
    ),
  },
  invitationStatus: {
    PENDING_DELIVERY: c(
      "gray",
      ["Menunggu pengiriman", "Email undangan sedang dikirim."],
      ["Sending", "The invitation email is being sent."],
    ),
    PENDING: c(
      "blue",
      ["Menunggu diterima", "Undangan terkirim; menunggu penerima bergabung."],
      ["Pending", "Invitation sent; waiting for the recipient to join."],
    ),
    ACCEPTED: c(
      "green",
      ["Diterima", "Penerima sudah bergabung."],
      ["Accepted", "The recipient has joined."],
    ),
    REVOKED: c(
      "red",
      ["Dibatalkan", "Undangan dibatalkan."],
      ["Revoked", "The invitation was revoked."],
    ),
  },
  auditAction: {
    DRAFT_CREATED: c(
      "blue",
      ["Draf dibuat", "Transaksi baru dibuat sebagai draf."],
      ["Draft created", "A new transaction was created as a draft."],
    ),
    DRAFT_IMPORTED: c(
      "blue",
      ["Draf diimpor", "Transaksi dibuat dari impor spreadsheet."],
      ["Draft imported", "Created from a spreadsheet import."],
    ),
    DRAFT_UPDATED: c(
      "gray",
      ["Draf diubah", "Data transaksi diperbarui."],
      ["Draft updated", "Transaction data was updated."],
    ),
    TRANSACTION_UPDATED: c(
      "gray",
      ["Transaksi diubah", "Data transaksi diperbarui."],
      ["Transaction updated", "Transaction data was updated."],
    ),
    DRAFT_VOIDED: c(
      "red",
      ["Dibatalkan", "Transaksi dibatalkan dengan alasan tercatat."],
      ["Voided", "The transaction was voided with a recorded reason."],
    ),
    TRANSACTION_VOIDED: c(
      "red",
      ["Dibatalkan", "Transaksi dibatalkan dengan alasan tercatat."],
      ["Voided", "The transaction was voided with a recorded reason."],
    ),
    COMMENT_ADDED: c(
      "gray",
      ["Komentar ditambahkan", "Catatan baru di percakapan transaksi."],
      ["Comment added", "A new note in the transaction thread."],
    ),
    DOCUMENT_UPLOADED: c(
      "gray",
      ["Dokumen diunggah", "Berkas sumber dilampirkan."],
      ["Document uploaded", "A source file was attached."],
    ),
    DOCUMENT_ATTACHED: c(
      "gray",
      ["Dokumen dilampirkan", "Berkas sumber dilampirkan."],
      ["Document attached", "A source file was attached."],
    ),
    DOCUMENT_DELETED: c(
      "red",
      [
        "Dokumen dihapus",
        "Berkas sumber dihapus permanen oleh pelanggan; hanya catatan audit yang tersisa.",
      ],
      [
        "Document deleted",
        "The source file was permanently deleted by the customer; only the audit record remains.",
      ],
    ),
    OFFER_UPDATED: c(
      "violet",
      [
        "Penawaran diperbarui",
        "Superadmin mengubah penawaran harga ruang kerja.",
      ],
      ["Offer updated", "A superadmin changed the workspace price offer."],
    ),
    TERMINATION_REQUESTED: c(
      "amber",
      [
        "Berhenti berlangganan diajukan",
        "Pemilik mengajukan berhenti berlangganan.",
      ],
      [
        "Cancellation requested",
        "The Owner requested to cancel the subscription.",
      ],
    ),
    TERMINATION_CANCELLED: c(
      "gray",
      [
        "Pengajuan berhenti dibatalkan",
        "Pemilik membatalkan pengajuan berhenti berlangganan.",
      ],
      [
        "Cancellation withdrawn",
        "The Owner withdrew the cancellation request.",
      ],
    ),
    WORKSPACE_TERMINATED: c(
      "red",
      ["Langganan berakhir", "Ruang kerja menjadi baca-saja."],
      ["Subscription ended", "The workspace became read-only."],
    ),
    DATA_PURGED: c(
      "red",
      [
        "Data dihapus otomatis",
        "Dokumen dan berkas XML dihapus setelah masa retensi.",
      ],
      [
        "Data deleted automatically",
        "Documents and XML files were deleted after the retention period.",
      ],
    ),
    INVOICE_ISSUED: c(
      "blue",
      ["Invoice diterbitkan", "Invoice bulanan diterbitkan."],
      ["Invoice issued", "A monthly invoice was issued."],
    ),
    INVOICE_PAID: c(
      "green",
      ["Invoice lunas", "Pembayaran invoice dicatat."],
      ["Invoice paid", "An invoice payment was recorded."],
    ),
    INVOICE_VOIDED: c(
      "gray",
      ["Invoice dibatalkan", "Invoice dibatalkan."],
      ["Invoice voided", "An invoice was voided."],
    ),
    DATA_EXPORTED: c(
      "violet",
      ["Data diekspor", "Salinan data ruang kerja diunduh oleh Pemilik/Admin."],
      [
        "Data exported",
        "A copy of the workspace data was downloaded by an Owner/Admin.",
      ],
    ),
    DOCUMENT_VIEWED: c(
      "gray",
      ["Dokumen dilihat", "Berkas sumber dibuka."],
      ["Document viewed", "The source file was opened."],
    ),
    TAX_EVALUATED: c(
      "blue",
      ["Pajak dievaluasi", "Mesin aturan menghitung DPP dan pajak."],
      ["Tax evaluated", "The rule engine computed the base and tax."],
    ),
    TAX_SUBMITTED: c(
      "amber",
      [
        "Diajukan untuk persetujuan",
        "Transaksi dikirim ke peninjau/penyetuju.",
      ],
      ["Submitted for approval", "Sent to reviewer/approver."],
    ),
    TRANSACTION_SUBMITTED: c(
      "amber",
      [
        "Diajukan untuk persetujuan",
        "Transaksi dikirim ke peninjau/penyetuju.",
      ],
      ["Submitted for approval", "Sent to reviewer/approver."],
    ),
    REVIEW_CHANGES_REQUESTED: c(
      "amber",
      ["Perbaikan diminta", "Peninjau meminta perubahan dengan alasan."],
      ["Changes requested", "The reviewer asked for changes with a reason."],
    ),
    TRANSACTION_CHANGES_REQUESTED: c(
      "amber",
      ["Perbaikan diminta", "Peninjau meminta perubahan dengan alasan."],
      ["Changes requested", "The reviewer asked for changes with a reason."],
    ),
    TAX_APPROVED: c(
      "green",
      ["Disetujui", "Snapshot pajak dikunci dan siap diekspor."],
      ["Approved", "Tax snapshot locked and ready to export."],
    ),
    TAX_REOPENED: c(
      "amber",
      [
        "Dibuka kembali",
        "Persetujuan dibatalkan; transaksi kembali dapat diubah.",
      ],
      ["Reopened", "Approval withdrawn; the transaction is editable again."],
    ),
    TRANSACTION_REOPENED: c(
      "amber",
      ["Dibuka kembali", "Transaksi kembali dapat diubah."],
      ["Reopened", "The transaction is editable again."],
    ),
    XML_EXPORTED: c(
      "green",
      ["Diekspor ke XML", "Masuk ke batch XML Coretax."],
      ["Exported to XML", "Included in a Coretax XML batch."],
    ),
    XML_EXPORT_CREATED: c(
      "green",
      ["Batch XML dibuat", "Berkas XML Coretax dibuat."],
      ["XML batch created", "A Coretax XML file was created."],
    ),
    XML_EXPORT_DOWNLOADED: c(
      "gray",
      ["XML diunduh", "Berkas XML diunduh."],
      ["XML downloaded", "The XML file was downloaded."],
    ),
    XML_OUTCOME_CORETAX_SUBMITTED: c(
      "amber",
      ["Diunggah ke Coretax", "Hasil unggah manual dicatat."],
      ["Uploaded to Coretax", "Manual upload recorded."],
    ),
    XML_OUTCOME_CORETAX_ACCEPTED: c(
      "green",
      ["Diterima Coretax", "Coretax menerima berkas."],
      ["Accepted by Coretax", "Coretax accepted the file."],
    ),
    XML_OUTCOME_CORETAX_REJECTED: c(
      "red",
      ["Ditolak Coretax", "Coretax menolak berkas."],
      ["Rejected by Coretax", "Coretax rejected the file."],
    ),
    OCR_JOB_QUEUED: c(
      "gray",
      ["OCR diantrekan", "Dokumen menunggu dibaca OCR."],
      ["OCR queued", "The document is waiting for OCR."],
    ),
    OCR_JOB_SUCCEEDED: c(
      "green",
      ["OCR berhasil", "Kandidat data tersedia untuk dikoreksi."],
      ["OCR succeeded", "Candidate data is ready to review."],
    ),
    OCR_JOB_COMPLETED: c(
      "green",
      ["OCR selesai", "Kandidat data tersedia untuk dikoreksi."],
      ["OCR completed", "Candidate data is ready to review."],
    ),
    OCR_JOB_RETRIED: c(
      "amber",
      ["OCR dicoba ulang", "Pembacaan OCR diulang."],
      ["OCR retried", "OCR was retried."],
    ),
    OCR_JOB_DEAD_LETTERED: c(
      "red",
      ["OCR gagal", "OCR gagal permanen; lanjutkan manual."],
      ["OCR failed", "OCR failed permanently; continue manually."],
    ),
    OCR_MANUAL_FALLBACK: c(
      "gray",
      ["Beralih ke input manual", "Pengguna memilih input manual."],
      ["Switched to manual", "The user chose manual entry."],
    ),
    OCR_CANDIDATES_APPLIED: c(
      "blue",
      ["Hasil OCR diterapkan", "Kandidat OCR disalin ke draf."],
      ["OCR applied", "OCR candidates copied into the draft."],
    ),
    OCR_CORRECTION_APPLIED: c(
      "blue",
      ["Koreksi OCR diterapkan", "Koreksi pengguna atas hasil OCR disimpan."],
      ["OCR correction applied", "User corrections to OCR were saved."],
    ),
    SUPPORT_ACCESS_GRANTED: c(
      "amber",
      ["Akses dukungan diberikan", "Pemilik/Admin memberi izin sementara."],
      ["Support access granted", "An Owner/Admin granted temporary access."],
    ),
    SUPPORT_ACCESS_REVOKED: c(
      "gray",
      ["Akses dukungan dicabut", "Izin sementara dicabut."],
      ["Support access revoked", "Temporary access was revoked."],
    ),
    SUPPORT_ACCESS_USED: c(
      "blue",
      ["Akses dukungan dipakai", "Tim dukungan membuka diagnostik."],
      ["Support access used", "Support opened diagnostics."],
    ),
    SUPPORT_DIAGNOSTICS_VIEWED: c(
      "blue",
      ["Diagnostik dilihat", "Tim dukungan melihat ringkasan diagnostik."],
      ["Diagnostics viewed", "Support viewed the diagnostics summary."],
    ),
    TRIAL_TRANSACTION_CREATED: c(
      "gray",
      ["Transaksi uji coba", "Dibuat dengan kuota uji coba akun."],
      ["Trial transaction", "Created under the account trial quota."],
    ),
    ENTITLED_TRANSACTION_CREATED: c(
      "gray",
      ["Transaksi langganan", "Dibuat dengan kuota langganan."],
      ["Subscription transaction", "Created under the subscription quota."],
    ),
  },
  readinessGate: {
    OFFICIAL_TEMPLATE: c(
      "blue",
      [
        "Templat resmi",
        "Templat XML resmi DJP terdaftar dan berstatus terverifikasi.",
      ],
      [
        "Official template",
        "An official DJP XML template is registered and verified.",
      ],
    ),
    SOURCE_HASH: c(
      "blue",
      [
        "Sidik jari sumber",
        "Hash SHA-256 berkas sumber resmi tercatat untuk audit.",
      ],
      [
        "Source fingerprint",
        "The SHA-256 hash of the official source file is recorded for audit.",
      ],
    ),
    XSD_ORDER: c(
      "blue",
      ["Struktur XSD", "Urutan elemen diturunkan dari skema XSD resmi."],
      [
        "XSD structure",
        "Element order is derived from the official XSD schema.",
      ],
    ),
    SERIALIZER: c(
      "violet",
      [
        "Generator XML",
        "Kode pembuat XML untuk jenis pajak ini sudah dibangun dari spesifikasi resmi.",
      ],
      [
        "XML generator",
        "The XML generator for this family is built from the official specification.",
      ],
    ),
    FIXTURE_TESTS: c(
      "green",
      [
        "Uji contoh resmi",
        "Hasil XML dibandingkan dengan contoh resmi DJP dan lolos.",
      ],
      [
        "Official sample test",
        "Generated XML was compared with the official DJP sample and passed.",
      ],
    ),
    SME_RULES: c(
      "green",
      [
        "Aturan ahli pajak",
        "Minimal satu aturan pajak untuk jenis ini disetujui ahli pajak.",
      ],
      [
        "Tax-expert rules",
        "At least one tax rule for this family is approved by a tax expert.",
      ],
    ),
  },
  retentionPolicy: {
    ZERO_RETENTION_REQUIRED: c(
      "green",
      [
        "Tanpa penyimpanan di vendor",
        "Vendor wajib tidak menyimpan dokumen maupun hasilnya setelah diproses.",
      ],
      [
        "Zero retention at vendor",
        "The vendor must not keep documents or results after processing.",
      ],
    ),
    EPHEMERAL_PROCESSING_ONLY: c(
      "blue",
      [
        "Diproses sementara",
        "Vendor hanya menyimpan data sementara selama pemrosesan.",
      ],
      [
        "Ephemeral processing",
        "The vendor keeps data only temporarily while processing.",
      ],
    ),
    LOCAL_ONLY: c(
      "gray",
      ["Lokal saja", "Dokumen tidak keluar dari server SerenTax."],
      ["Local only", "Documents never leave the SerenTax server."],
    ),
  },
  invoiceStatus: {
    DRAFT: c(
      "gray",
      ["Draf", "Belum diterbitkan; hanya terlihat oleh superadmin."],
      ["Draft", "Not issued yet; visible to superadmins only."],
    ),
    ISSUED: c(
      "blue",
      ["Belum dibayar", "Invoice diterbitkan dan menunggu pembayaran."],
      ["Unpaid", "Issued and awaiting payment."],
    ),
    OVERDUE: c(
      "red",
      ["Lewat jatuh tempo", "Belum dibayar setelah tanggal jatuh tempo."],
      ["Overdue", "Not paid after the due date."],
    ),
    PAID: c(
      "green",
      ["Lunas", "Pembayaran sudah dicatat."],
      ["Paid", "Payment has been recorded."],
    ),
    VOID: c(
      "gray",
      ["Dibatalkan", "Invoice dibatalkan dan tidak perlu dibayar."],
      ["Void", "Cancelled; no payment needed."],
    ),
  },
  terminationStatus: {
    REQUESTED: c(
      "amber",
      [
        "Akan berakhir",
        "Berhenti berlangganan diajukan; layanan tetap aktif sampai tanggal efektif.",
      ],
      [
        "Ending",
        "Cancellation requested; the service stays active until the effective date.",
      ],
    ),
    CANCELLED: c(
      "gray",
      ["Dibatalkan", "Pengajuan berhenti berlangganan dibatalkan."],
      ["Withdrawn", "The cancellation request was withdrawn."],
    ),
    TERMINATED: c(
      "red",
      [
        "Berakhir",
        "Langganan berakhir; data hanya bisa dilihat dan diekspor sampai dihapus.",
      ],
      [
        "Ended",
        "Subscription ended; data can be viewed and exported until deletion.",
      ],
    ),
    PURGED: c(
      "gray",
      [
        "Dokumen dihapus",
        "Masa retensi selesai; dokumen dan berkas XML telah dihapus.",
      ],
      [
        "Documents deleted",
        "Retention ended; documents and XML files were deleted.",
      ],
    ),
  },
  leadStatus: {
    NEW: c(
      "blue",
      ["Baru", "Pendaftaran baru, belum dihubungi."],
      ["New", "New registration, not contacted yet."],
    ),
    CONTACTED: c(
      "amber",
      ["Sudah dihubungi", "Tim sales sudah menghubungi PIC."],
      ["Contacted", "Sales has contacted the person in charge."],
    ),
    CONVERTED: c(
      "green",
      [
        "Menjadi pelanggan",
        "Ruang kerja sudah dibuat dan penawaran disetujui.",
      ],
      ["Converted", "A workspace was created and the offer accepted."],
    ),
    REJECTED: c(
      "gray",
      ["Tidak dilanjutkan", "Prospek tidak berlanjut."],
      ["Not pursued", "The lead did not proceed."],
    ),
  },
  pricingModel: {
    SUBSCRIPTION: c(
      "blue",
      ["Langganan", "Kuota bulanan dari paket langganan (lisensi)."],
      ["Subscription", "Monthly quota from a subscription plan (license)."],
    ),
    PER_INVOICE: c(
      "violet",
      [
        "Per faktur",
        "Ditagih per faktur yang diproses setiap bulan sesuai surat penawaran.",
      ],
      [
        "Per invoice",
        "Charged per invoice processed each month under the offer letter.",
      ],
    ),
  },
  entitlement: {
    MONTHLY_TRANSACTIONS: c(
      "blue",
      [
        "Transaksi per bulan",
        "Jumlah transaksi baru yang boleh dibuat setiap bulan kalender (WIB).",
      ],
      [
        "Transactions per month",
        "New transactions allowed each calendar month (WIB).",
      ],
    ),
    MONTHLY_XML_EXPORTS: c(
      "violet",
      [
        "Ekspor XML per bulan",
        "Jumlah batch XML Coretax yang boleh dibuat setiap bulan.",
      ],
      ["XML exports per month", "Coretax XML batches allowed each month."],
    ),
    MAX_COMPANIES: c(
      "gray",
      ["Perusahaan aktif", "Jumlah maksimum perusahaan pemotong aktif."],
      ["Active companies", "Maximum number of active withholding companies."],
    ),
    MAX_MEMBERS: c(
      "gray",
      ["Anggota tim", "Jumlah maksimum anggota ruang kerja."],
      ["Team members", "Maximum number of workspace members."],
    ),
    ALLOW_EXTERNAL_OCR: c(
      "green",
      [
        "OCR AI eksternal",
        "Boleh memakai penyedia OCR AI eksternal yang disetujui.",
      ],
      ["External AI OCR", "May use an approved external AI OCR provider."],
    ),
  },
  ocrError: {
    OCR_NOT_CONFIGURED: c(
      "red",
      [
        "Penyedia belum dikonfigurasi",
        "Adaptor atau endpoint penyedia belum diatur dengan benar.",
      ],
      [
        "Provider not configured",
        "The provider adapter or endpoint is not set up correctly.",
      ],
    ),
    OCR_PROVIDER_DISABLED: c(
      "gray",
      ["OCR dinonaktifkan", "Ruang kerja memakai input manual."],
      ["OCR disabled", "The workspace uses manual entry."],
    ),
    OCR_PROVIDER_ERROR: c(
      "amber",
      [
        "Gangguan di penyedia",
        "Penyedia mengembalikan galat; job dicoba ulang bila sementara.",
      ],
      [
        "Provider error",
        "The provider returned an error; temporary failures are retried.",
      ],
    ),
    OCR_TIMEOUT: c(
      "amber",
      ["Waktu habis", "Penyedia terlalu lama merespons; job dicoba ulang."],
      ["Timed out", "The provider took too long; the job is retried."],
    ),
    OCR_INVALID_DOCUMENT: c(
      "red",
      [
        "Dokumen tidak bisa dibaca",
        "Berkas rusak atau jenisnya tidak didukung.",
      ],
      [
        "Unreadable document",
        "The file is damaged or its type is not supported.",
      ],
    ),
    OCR_PAGE_LIMIT: c(
      "red",
      ["Terlalu banyak halaman", "Dokumen melebihi batas halaman per dokumen."],
      ["Too many pages", "The document exceeds the page limit per document."],
    ),
    OCR_SECRET_MISSING: c(
      "red",
      [
        "Kunci API belum tersedia",
        "Variabel rahasia server untuk penyedia belum diisi atau ditolak.",
      ],
      [
        "API key missing",
        "The provider secret variable is not set or was rejected.",
      ],
    ),
  },
  roundingMode: {
    HALF_UP: c(
      "gray",
      ["Pembulatan standar", "0,5 ke atas dibulatkan naik."],
      ["Standard rounding", "0.5 and above rounds up."],
    ),
    FLOOR: c(
      "gray",
      ["Bulatkan ke bawah", "Selalu dibulatkan turun."],
      ["Round down", "Always rounds down."],
    ),
    CEIL: c(
      "gray",
      ["Bulatkan ke atas", "Selalu dibulatkan naik."],
      ["Round up", "Always rounds up."],
    ),
  },
} as const;

export type CodeDomain = keyof typeof codeRegistry;

/** Functional label + help + tone for a code (falls back to a humanised code). */
export function codeEntry(
  locale: Locale,
  domain: CodeDomain,
  code: string | null | undefined,
): CodeEntry {
  const table = codeRegistry[domain] as Record<string, Bilingual>;
  const entry = code ? table[code] : undefined;
  if (!entry) {
    const fallback = (code ?? "—").toLowerCase().replace(/[_.]+/g, " ");
    return {
      tone: "gray",
      label: fallback.charAt(0).toUpperCase() + fallback.slice(1),
      help: "",
    };
  }
  const [label, help] = entry[locale];
  return { tone: entry.tone, label, help };
}

export function codeLabel(
  locale: Locale,
  domain: CodeDomain,
  code: string | null | undefined,
) {
  return codeEntry(locale, domain, code).label;
}

/** Combobox options for a code domain (label + help as description). */
export function codeOptions(
  locale: Locale,
  domain: CodeDomain,
  codes?: readonly string[],
) {
  const table = codeRegistry[domain] as Record<string, Bilingual>;
  return (codes ?? Object.keys(table)).map((code) => {
    const { label, help } = codeEntry(locale, domain, code);
    return { value: code, label, description: help };
  });
}
