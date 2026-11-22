import type { Locale } from "./messages";
export const siteMessages = {
  id: {
    home: "Beranda",
    features: "Fitur",
    workflow: "Cara kerja",
    pricing: "Harga",
    faq: "Pertanyaan umum",
    security: "Keamanan",
    terms: "Syarat penggunaan",
    privacy: "Privasi",
    menu: "Menu navigasi",
    close: "Tutup menu",
    navigation: "Navigasi utama",
    footer: "Informasi produk",
    language: "Pilih bahasa",
    light: "Tema terang",
    dark: "Tema gelap",
    theme: "Tema tampilan",
    eyebrow: "Serentak menyiapkan. Teliti meninjau.",
    preview: "Rilis awal · Dalam pengembangan",
    intro:
      "Satu tempat untuk menata pekerjaan tim pajak. Akun, ruang kerja, dan uji coba sudah tersedia; alur transaksi dan ekspor sedang disiapkan.",
    createAccount: "Buat akun",
    explore: "Lihat status fitur",
    designed: "Dari dokumen ke data yang dapat ditinjau",
    promise: "Langkah kerja yang jelas. Keputusan tetap di tangan Anda.",
    promiseBody:
      "SerenTax dirancang untuk mengurangi entri berulang, menjaga jejak sumber, dan membantu tim meninjau data sebelum impor manual ke Coretax.",
    current: "Tersedia sekarang",
    planned: "Belum tersedia",
    verification: "Belum diverifikasi",
    templateVerified:
      "Templat XML BPPU v.3 terverifikasi · Menunggu aturan SME",
    unsupported: "Belum didukung",
    status: "Status",
    family: "Keluarga dokumen",
    accounts: "Akun terverifikasi",
    accountsBody:
      "Verifikasi email, pemulihan kata sandi, dan pengelolaan sesi.",
    workspaces: "Ruang kerja & peran",
    workspacesBody:
      "Organisasi terpisah, undangan anggota, dan akses sesuai peran.",
    trial: "Uji coba per akun",
    trialBody:
      "Aktivasi 72 jam, maksimum 1 transaksi per hari Jakarta dan 3 transaksi total lintas ruang kerja.",
    intake: "Input manual & spreadsheet",
    intakeBody:
      "Profil perusahaan, lawan transaksi, draf invoice manual, impor spreadsheet dengan pratinjau baris, dan lampiran dokumen sumber sudah tersedia.",
    review: "Tinjauan & persetujuan",
    reviewBody:
      "Alur pengajuan, permintaan perbaikan, persetujuan terkunci, dan mesin aturan deterministik sudah tersedia. Persetujuan produksi diblokir sampai katalog aturan resmi disetujui ahli pajak (SME).",
    export: "XML untuk impor manual",
    exportBody:
      "Registri templat resmi DJP dan generator XML BPPU v.3 terverifikasi sumber tersedia untuk snapshot SME_APPROVED yang telah disetujui. Keluarga dokumen lain diblokir (TEMPLATE_UNVERIFIED), dan unggah ke Coretax tetap manual.",
    ocr: "OCR opsional",
    ocrBody:
      "Pengaturan penyedia OCR (default NONE) dan alur koreksi kandidat sudah tersedia. Penyedia AI eksternal produksi berstatus NOT_CONFIGURED sampai persetujuan vendor dan kredensial disiapkan.",
    featuresIntro:
      "Lihat kemampuan yang sudah berjalan dan batas pengembangan saat ini. Tidak ada ekspor pajak yang tersedia pada rilis ini.",
    familiesTitle: "Status dokumen pajak",
    familiesIntro:
      "Nama keluarga berikut adalah ruang lingkup yang direncanakan. Tidak satu pun dapat diekspor saat ini.",
    families: {
      BPPU: "BPPU · PPh Unifikasi",
      FAKTUR: "Faktur keluaran · PPN",
      BPNR: "BPNR · PPh Unifikasi",
      BP21: "BP21 · PPh 21",
      BPMP: "BPMP · PPh 21",
      BPA1: "BPA1 · PPh 21",
      BPA2: "BPA2 · PPh 21",
      BP26: "BP26 · PPh 26",
    },
    workflowIntro:
      "Alur yang direncanakan, dari input sampai impor manual. Tahap transaksi, persetujuan, dan ekspor belum dirilis.",
    step1: "Siapkan sumber",
    step1Body:
      "Masukkan data manual atau dari spreadsheet. OCR nantinya bersifat opsional; hasil ekstraksi harus ditinjau.",
    step2: "Periksa bersama tim",
    step2Body:
      "Lengkapi identitas, bukti, dan klasifikasi. Peninjau memeriksa data dengan aturan yang telah disetujui.",
    step3: "Setujui dan ekspor",
    step3Body:
      "Pemberi persetujuan mengunci revisi. XML hanya dibuat dari templat resmi yang terverifikasi.",
    step4: "Impor secara manual",
    step4Body:
      "Pengguna mengunggah berkas sendiri ke Coretax. Hasil penerimaan dicatat manual, bukan sinkronisasi DJP.",
    pricingIntro:
      "Harga paket akan mengikuti katalog penjual Berlanggan yang terverifikasi. Belum ada langganan yang dapat dibeli melalui SerenTax.",
    catalogPending: "Katalog paket belum tersedia",
    catalogPendingBody:
      "Integrasi katalog dan kesesuaian lisensi SaaS masih perlu diverifikasi. Harga, manfaat paket, dan tautan pembayaran belum diterbitkan.",
    catalogUnavailable: "Katalog tidak dapat dimuat",
    catalogUnavailableBody:
      "Paket tidak dapat ditampilkan saat ini. Tidak ada pembelian atau perubahan akses yang dilakukan.",
    trialCaution:
      "Aktivasi uji coba langsung memulai waktu 72 jam dan hanya dapat dilakukan sekali; Anda dapat menunggu sampai siap membuat transaksi pertama.",
    trialRules: [
      "Satu aktivasi untuk akun yang sudah terverifikasi.",
      "Maksimum 1 transaksi baru per hari kalender Asia/Jakarta.",
      "Maksimum 3 transaksi selama uji coba, lintas organisasi.",
      "Penghapusan dan retry tidak mengembalikan kuota.",
    ],
    faqIntro: "Jawaban ringkas tentang status produk dan cara kerjanya.",
    questions: [
      {
        q: "Apakah SerenTax sudah dapat membuat XML?",
        a: "Belum. Ekspor diblokir sampai templat resmi DJP, pemetaan, dan fixture telah diverifikasi. Tidak ada klaim berkas diterima Coretax.",
      },
      {
        q: "Apakah SerenTax mengirim pajak otomatis?",
        a: "Tidak. Alur yang direncanakan adalah menyiapkan berkas untuk impor manual oleh pengguna. SerenTax tidak menyimpan kata sandi atau OTP Coretax.",
      },
      {
        q: "Apakah AI menentukan pajak saya?",
        a: "Tidak. OCR hanya akan mengusulkan data sumber. Klasifikasi dan aturan pajak memerlukan validasi ahli serta persetujuan manusia.",
      },
      {
        q: "Bagaimana batas uji coba dihitung?",
        a: "72 jam sejak aktivasi. Maksimum 1 transaksi per hari Jakarta dan 3 total per akun di seluruh organisasi. Pembuatan transaksi belum dirilis, jadi pertimbangkan menunda aktivasi.",
      },
      {
        q: "Di mana saya dapat melihat harga atau membeli paket?",
        a: "Belum tersedia. Harga akan berasal dari katalog Berlanggan setelah integrasi dan lisensi SaaS terverifikasi; tidak ada tautan pembayaran aktif.",
      },
      {
        q: "Dapatkah satu invoice mencakup semua jenis pajak?",
        a: "Tidak. Beberapa keluarga memerlukan data penggajian, bukti atau informasi tambahan. Dukungan hanya akan dibuka setelah persyaratannya diverifikasi.",
      },
    ],
    securityIntro:
      "Kontrol yang sudah diterapkan, serta batas yang masih memerlukan peninjauan sebelum peluncuran produksi.",
    securityItems: [
      {
        title: "Akses sesuai akun dan organisasi",
        body: "Sesi, verifikasi email, dan keanggotaan diperiksa di server. Perubahan peran dan pencabutan akses diperiksa ulang pada operasi ruang kerja.",
      },
      {
        title: "Kredensial tetap di server",
        body: "Kata sandi dikelola melalui Better Auth. Rahasia koneksi dan SMTP tidak dikirim ke browser. Konfigurasi deployment tetap menjadi tanggung jawab operator.",
      },
      {
        title: "Tidak ada koneksi otomatis ke Coretax",
        body: "Tidak ada penyimpanan kata sandi, OTP, sertifikat, atau kunci penandatanganan Coretax.",
      },
      {
        title: "Peninjauan produksi belum selesai",
        body: "MFA untuk akses istimewa, kebijakan retensi, pemroses data, dan peninjauan hukum masih terbuka. Tidak ada klaim sertifikasi atau registrasi yang telah diselesaikan.",
      },
    ],
    legalPending: "Draf · Menunggu peninjauan hukum",
    legalIntro:
      "Halaman ini adalah placeholder pengembangan, bukan dokumen hukum final. Jangan gunakan untuk menyatakan kesiapan komersial atau kepatuhan.",
    termsSections: [
      {
        title: "Tujuan dan batas layanan",
        body: "SerenTax menyiapkan alur peninjauan dokumen pajak. Layanan ini bukan DJP, PJAP, atau pengganti penasihat pajak. Fitur yang belum tersedia ditandai pada halaman fitur.",
      },
      {
        title: "Ketentuan komersial belum ditetapkan",
        body: "Identitas badan usaha, yurisdiksi, tanggung jawab, dukungan, penghentian layanan, dan ketentuan langganan memerlukan persetujuan pemilik produk dan penasihat hukum.",
      },
      {
        title: "Sebelum penggunaan produksi",
        body: "Dokumen final dan proses persetujuan pengguna harus diselesaikan sebelum menerima data pelanggan produksi atau mengaktifkan langganan.",
      },
    ],
    privacySections: [
      {
        title: "Data pada rilis saat ini",
        body: "Fitur akun menggunakan nama, email, kredensial autentikasi, sesi, keanggotaan, undangan, dan pemakaian trial. Unggah invoice dan OCR belum tersedia.",
      },
      {
        title: "Kebijakan yang masih perlu ditetapkan",
        body: "Dasar pemrosesan, lokasi penyimpanan, pemroses, masa retensi, hak subjek data, penghapusan, dan kontak privasi belum difinalisasi.",
      },
      {
        title: "Batas sementara",
        body: "Jangan unggah data wajib pajak atau pelanggan produksi pada rilis pengembangan ini. Halaman ini tidak menyatakan kepatuhan atau menggantikan pemberitahuan privasi final.",
      },
    ],
    appTitle: "Ringkasan",
    appIntro: "Ruang kerja Anda, dengan status yang jelas.",
    settings: "Akun & tim",
    companies: "Perusahaan",
    counterparties: "Lawan transaksi",
    transactions: "Transaksi",
    imports: "Impor",
    exports: "Ekspor",
    reconciliation: "Rekonsiliasi",
    help: "Bantuan",
    workspaceLabel: "Ruang kerja aktif",
    chooseWorkspace: "Pilih ruang kerja",
    noWorkspace: "Belum ada ruang kerja",
    manageWorkspace: "Kelola ruang kerja",
    accountArea: "Ruang kerja aplikasi",
    emptyTitle: "Siapkan draf transaksi manual & spreadsheet",
    emptyBody:
      "Atur profil perusahaan dan lawan transaksi, buat draf manual atau impor spreadsheet, lalu evaluasi, ajukan, setujui, dan ekspor transaksi BPPU ke XML.",
    noActiveBody:
      "Buat ruang kerja atau terima undangan untuk mulai menata tim Anda.",
    appError: "Ruang kerja tidak dapat dimuat. Coba muat ulang.",
    refresh: "Muat ulang",
    settingsIntro: "Kelola profil, organisasi, anggota, dan sesi Anda.",
    helpIntro:
      "Gunakan halaman akun untuk membuat ruang kerja, mengundang anggota, atau mengakhiri sesi. Baca status fitur sebelum mengaktifkan trial.",
    futureNote:
      "Halaman ini belum memiliki operasi transaksi. Tidak ada data contoh yang dianggap sebagai catatan Anda.",
    trialLink: "Lihat aturan uji coba",
    featuresLink: "Lihat status rilis",
    teamHint: "Peran dan keanggotaan diperiksa kembali di server.",
  },
  en: {
    home: "Home",
    features: "Features",
    workflow: "How it works",
    pricing: "Pricing",
    faq: "FAQ",
    security: "Security",
    terms: "Terms of use",
    privacy: "Privacy",
    menu: "Navigation menu",
    close: "Close menu",
    navigation: "Main navigation",
    footer: "Product information",
    language: "Choose language",
    light: "Light theme",
    dark: "Dark theme",
    theme: "Display theme",
    eyebrow: "Prepare together. Review with care.",
    preview: "Early release · In development",
    intro:
      "One place to organize your tax team’s work. Accounts, workspaces, and trials are available; transaction and export workflows are being prepared.",
    createAccount: "Create account",
    explore: "Explore feature status",
    designed: "From documents to reviewable data",
    promise: "Clear steps. Decisions stay with you.",
    promiseBody:
      "SerenTax is designed to reduce repeated entry, preserve source evidence, and help teams review data before manual Coretax import.",
    current: "Available now",
    planned: "Not yet available",
    verification: "Not yet verified",
    templateVerified: "BPPU v.3 XML template verified · Pending SME rules",
    unsupported: "Not supported yet",
    status: "Status",
    family: "Document family",
    accounts: "Verified accounts",
    accountsBody:
      "Email verification, password recovery, and session management.",
    workspaces: "Workspaces & roles",
    workspacesBody:
      "Separate organizations, member invitations, and role-based access.",
    trial: "Account trial",
    trialBody:
      "72-hour activation, at most 1 transaction per Jakarta day and 3 total across workspaces.",
    intake: "Manual & spreadsheet intake",
    intakeBody:
      "Company profiles, counterparties, manual invoice drafts, spreadsheet imports with row-level preview, and source document attachments are available.",
    review: "Review & approval",
    reviewBody:
      "Submission, change requests, immutable approval snapshots, and the deterministic rule engine are available. Production approval remains blocked until a Tax SME-approved rule catalog exists.",
    export: "XML for manual import",
    exportBody:
      "The official DJP template registry and source-verified BPPU v.3 XML exporter are available for approved SME_APPROVED snapshots. Other document families fail closed (TEMPLATE_UNVERIFIED), and Coretax upload remains manual.",
    ocr: "Optional OCR",
    ocrBody:
      "Configurable OCR provider registry (NONE by default) and side-by-side candidate correction are available. Production external AI OCR remains NOT_CONFIGURED until vendor approval and credentials are supplied.",
    featuresIntro:
      "See what works today and the current development boundaries. No tax export is available in this release.",
    familiesTitle: "Tax document status",
    familiesIntro:
      "These families describe planned scope. None can be exported at present.",
    families: {
      BPPU: "BPPU · Unified withholding",
      FAKTUR: "Output invoice · VAT",
      BPNR: "BPNR · Unified withholding",
      BP21: "BP21 · Income tax 21",
      BPMP: "BPMP · Income tax 21",
      BPA1: "BPA1 · Income tax 21",
      BPA2: "BPA2 · Income tax 21",
      BP26: "BP26 · Income tax 26",
    },
    workflowIntro:
      "The planned path from intake to manual import. Transaction, approval, and export stages are not released yet.",
    step1: "Prepare the source",
    step1Body:
      "Enter data manually or from a spreadsheet. Future OCR is optional; extracted fields must be reviewed.",
    step2: "Check with your team",
    step2Body:
      "Complete identities, evidence, and classification. Reviewers check data against approved rules.",
    step3: "Approve and export",
    step3Body:
      "An approver locks the revision. XML is generated only from verified official templates.",
    step4: "Import manually",
    step4Body:
      "Users upload files to Coretax themselves. Acceptance is recorded manually, not synchronized with DJP.",
    pricingIntro:
      "Plan prices will come from the verified Berlanggan seller catalog. No subscription can be purchased through SerenTax yet.",
    catalogPending: "Plan catalog not available",
    catalogPendingBody:
      "Catalog integration and SaaS license compatibility still need verification. Prices, plan benefits, and payment links have not been published.",
    catalogUnavailable: "Catalog could not be loaded",
    catalogUnavailableBody:
      "Plans cannot be displayed right now. No purchase or access change has been made.",
    trialCaution:
      "Trial activation starts the 72-hour clock immediately and can only happen once; you can wait until you are ready to create your first transaction.",
    trialRules: [
      "One activation for a verified account.",
      "At most 1 new transaction per Asia/Jakarta calendar day.",
      "At most 3 transactions during the trial across organizations.",
      "Deletion and retries do not restore allowance.",
    ],
    faqIntro:
      "Straightforward answers about product status and the planned workflow.",
    questions: [
      {
        q: "Can SerenTax generate XML today?",
        a: "Not yet. Export is blocked until official DJP templates, mappings, and fixtures are verified. We do not claim that a file has been accepted by Coretax.",
      },
      {
        q: "Does SerenTax file tax automatically?",
        a: "No. The planned workflow prepares files for manual import by the user. SerenTax does not store Coretax passwords or OTPs.",
      },
      {
        q: "Does AI decide my tax?",
        a: "No. Future OCR will only suggest source fields. Tax classification and rules require expert validation and human approval.",
      },
      {
        q: "How is the trial allowance calculated?",
        a: "72 hours from activation, at most 1 transaction per Jakarta day and 3 total per account across organizations. Intake is not released yet, so consider delaying activation.",
      },
      {
        q: "Where can I see prices or buy a plan?",
        a: "Plans are not available yet. Prices will come from Berlanggan after catalog integration and SaaS licensing are verified. There is no active payment link.",
      },
      {
        q: "Can one invoice cover every tax family?",
        a: "No. Some families need payroll data, evidence, or additional facts. Support will open only after their requirements are verified.",
      },
    ],
    securityIntro:
      "Controls already implemented, and boundaries that still require review before a production launch.",
    securityItems: [
      {
        title: "Account and organization access",
        body: "Sessions, email verification, and membership are checked on the server. Workspace operations recheck role changes and revoked access.",
      },
      {
        title: "Credentials stay on the server",
        body: "Better Auth manages passwords. Connection and SMTP secrets are not sent to the browser. Deployment configuration remains the operator’s responsibility.",
      },
      {
        title: "No automatic Coretax connection",
        body: "There is no storage of Coretax passwords, OTPs, certificates, or signing keys.",
      },
      {
        title: "Production review is incomplete",
        body: "Privileged-access MFA, retention, data processors, and legal review remain open. No completed certification or registration is claimed.",
      },
    ],
    legalPending: "Draft · Pending legal review",
    legalIntro:
      "This page is a development placeholder, not a final legal document. It must not be used to claim commercial readiness or compliance.",
    termsSections: [
      {
        title: "Purpose and service limits",
        body: "SerenTax is preparing tax document review workflows. It is not DJP, a PJAP, or a substitute for a tax adviser. Unavailable capabilities are marked on the features page.",
      },
      {
        title: "Commercial terms are not finalized",
        body: "Legal entity, jurisdiction, liability, support, service termination, and subscription terms require product-owner and legal approval.",
      },
      {
        title: "Before production use",
        body: "Final documents and the user acceptance process must be completed before accepting production customer data or enabling subscriptions.",
      },
    ],
    privacySections: [
      {
        title: "Data in the current release",
        body: "Account features use names, email addresses, authentication credentials, sessions, memberships, invitations, and trial usage. Invoice uploads and OCR are not available.",
      },
      {
        title: "Policies still to be defined",
        body: "Processing basis, storage location, processors, retention periods, data-subject rights, deletion, and privacy contacts are not finalized.",
      },
      {
        title: "Interim boundary",
        body: "Do not upload production taxpayer or customer data in this development release. This page does not claim compliance or replace a final privacy notice.",
      },
    ],
    appTitle: "Overview",
    appIntro: "Your workspace, with a clear view of what is available.",
    settings: "Account & team",
    companies: "Companies",
    counterparties: "Counterparties",
    transactions: "Transactions",
    imports: "Imports",
    exports: "Exports",
    reconciliation: "Reconciliation",
    help: "Help",
    workspaceLabel: "Active workspace",
    chooseWorkspace: "Choose a workspace",
    noWorkspace: "No workspace yet",
    manageWorkspace: "Manage workspaces",
    accountArea: "Application workspace",
    emptyTitle: "Prepare manual & spreadsheet transaction drafts",
    emptyBody:
      "Set up company profiles and counterparties, create manual drafts or import spreadsheets, then evaluate, submit, approve and export BPPU transactions to XML.",
    noActiveBody:
      "Create a workspace or accept an invitation to start organizing your team.",
    appError: "Workspaces could not be loaded. Try reloading.",
    refresh: "Reload",
    settingsIntro: "Manage your profile, organizations, members, and sessions.",
    helpIntro:
      "Use account settings to create a workspace, invite members, or end a session. Check feature status before activating a trial.",
    futureNote:
      "This page has no transaction operations yet. No sample data is presented as your records.",
    trialLink: "Read trial rules",
    featuresLink: "View release status",
    teamHint: "Roles and membership are rechecked on the server.",
  },
} satisfies Record<Locale, object>;
