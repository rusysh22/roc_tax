import type { Locale } from "./messages";
export const accountMessages = {
  id: {
    signIn: "Masuk",
    signUp: "Buat akun",
    signOut: "Keluar",
    email: "Email",
    password: "Kata sandi",
    name: "Nama",
    passwordHint: "Gunakan 12–128 karakter.",
    forgot: "Lupa kata sandi",
    reset: "Atur ulang kata sandi",
    verify: "Verifikasi email",
    resend: "Kirim ulang verifikasi",
    checkEmail:
      "Jika permintaan memenuhi syarat, email petunjuk akan dikirim. Periksa kotak masuk dan spam.",
    verifiedHelp:
      "Buka tautan verifikasi di email Anda, lalu masuk. Tautan yang kedaluwarsa dapat dikirim ulang.",
    saved: "Perubahan disimpan.",
    failed:
      "Permintaan tidak dapat diproses. Periksa data, verifikasi email, atau coba lagi nanti.",
    unavailable:
      "Layanan akun belum tersedia. Administrator perlu menyiapkan basis data dan pengiriman email.",
    busy: "Memproses…",
    home: "Beranda",
    account: "Akun & ruang kerja",
    profile: "Profil akun",
    save: "Simpan",
    workspaces: "Ruang kerja",
    create: "Buat ruang kerja",
    workspaceName: "Nama ruang kerja",
    legalName: "Nama badan hukum",
    select: "Aktifkan",
    noWorkspace:
      "Belum ada ruang kerja aktif. Buat ruang kerja atau terima undangan.",
    team: "Tim",
    invite: "Undang anggota",
    role: "Peran",
    roles: {
      OWNER: "Pemilik",
      ADMIN: "Admin",
      PREPARER: "Penyusun",
      REVIEWER: "Peninjau",
      APPROVER: "Pemberi persetujuan",
    },
    revoke: "Cabut akses",
    cancel: "Batalkan undangan",
    invitations: "Undangan tertunda",
    noInvites: "Tidak ada undangan tertunda.",
    accept: "Terima undangan",
    invitationHelp:
      "Masuk atau daftar menggunakan email penerima, lalu buka kembali tautan undangan. Undangan berlaku 48 jam dan hanya dapat digunakan sekali.",
    sessions: "Sesi aktif",
    currentSession: "Sesi ini",
    revokeSession: "Akhiri sesi",
    revokeOthers: "Akhiri sesi lain",
    unknownDevice: "Perangkat tidak diketahui",
    noTransactions:
      "Akun, ruang kerja, profil perusahaan, lawan transaksi, draf manual, impor, evaluasi dan persetujuan pajak, serta ekspor XML BPPU tersedia.",
    confirm: "Konfirmasi tindakan ini?",
    forbidden:
      "Akses ditolak. Peran atau keanggotaan Anda mungkin telah berubah.",
    originMismatch:
      "Permintaan ditolak karena alamat aplikasi tidak cocok. Buka SerenTax melalui alamat resmi yang dikonfigurasi, lalu coba lagi.",
    invalidCredentials: "Email atau kata sandi salah.",
    emailNotVerified:
      'Email belum diverifikasi. Buka tautan verifikasi di email Anda atau kirim ulang melalui "Verifikasi email".',
    invalidInvite:
      "Undangan tidak berlaku, sudah digunakan, kedaluwarsa, atau ditujukan untuk email lain.",
    lastOwner: "Ruang kerja harus memiliki setidaknya satu pemilik.",
    conflict:
      "Data telah berubah atau anggota/undangan sudah ada. Muat ulang dan coba lagi.",
    rateLimited: "Terlalu banyak permintaan. Coba lagi nanti.",
    refresh: "Muat ulang",
    expires: "Berlaku hingga",
    changedPassword: "Kata sandi diubah. Silakan masuk kembali.",
    settings: {
      subtitle: "Profil Anda, ruang kerja, tim, peran, dan keamanan akun.",
      noActive: "Belum ada ruang kerja aktif",
      yourRole: "Peran Anda",
      tabs: {
        profile: "Profil",
        workspaces: "Ruang kerja",
        team: "Tim",
        roles: "Peran & hak akses",
        approval: "Persetujuan",
        support: "Akses dukungan",
        security: "Keamanan & sesi",
      },
      profileIntro:
        "Data yang dipakai SerenTax untuk mengenali Anda di komentar, riwayat audit, dan persetujuan.",
      permissionsTitle: "Yang dapat Anda lakukan di ruang kerja ini",
      noPermissions:
        "Pilih atau buat ruang kerja untuk melihat hak akses Anda.",
      myWorkspaces: "Ruang kerja saya",
      activeBadge: "Aktif",
      workspaceSettings: "Pengaturan ruang kerja",
      ocrSettingsHint: "Pilih cara membaca dokumen (manual atau penyedia OCR).",
      billingHint: "Status lisensi, kuota, dan penggunaan.",
      members: "Anggota",
      member: "Anggota",
      noMembers: "Belum ada anggota lain.",
      inviteIntro:
        "Undangan dikirim lewat email, berlaku 48 jam, dan hanya untuk email tersebut.",
      matrixIntro:
        "Matriks ini dibaca langsung dari kebijakan akses sistem. Arahkan kursor ke ikon info untuk penjelasan setiap hak akses dan peran.",
      permission: "Hak akses",
      allowed: "Diizinkan",
      notAllowed: "Tidak diizinkan",
      approvalIntro:
        "Atur apakah pembuat transaksi boleh menyetujui transaksinya sendiri.",
      securityIntro:
        "Kelola kata sandi dan perangkat yang sedang masuk ke akun Anda.",
      device: "Perangkat",
      thisDevice: "Perangkat ini",
      status: "Status",
      actions: "Tindakan",
      changeRoleConfirm: "Ubah peran anggota ini?",
      privacy: {
        tab: "Data & privasi",
        commitmentTitle: "Komitmen penggunaan data",
        commitment1:
          "Data Anda (transaksi, faktur, NPWP/NIK) hanya diproses untuk menjalankan layanan bagi ruang kerja ini dan tidak dijual. Tim dukungan hanya dapat melihat diagnostik bila Pemilik/Admin memberi izin sementara yang tercatat.",
        commitment2:
          "SerenTax tidak memakai data Anda untuk melatih atau mengembangkan model AI. Vendor AI/OCR hanya disetujui platform bila ketentuannya melarang pemakaian data pelanggan untuk pelatihan model.",
        commitment3:
          "Dokumen hanya dikirim ke vendor AI/OCR yang disetujui platform dan setelah Pemilik/Admin menyetujui pemrosesan AI; vendor dipakai hanya untuk membaca dan mengklasifikasi isi dokumen. Lokasi pemrosesan vendor ditampilkan di daftar subprocessor.",
        commitment4:
          "NPWP/NIK disimpan terenkripsi, dan akses dokumen, ekspor data, unduhan XML, serta penghapusan dicatat di log audit ruang kerja.",
        documentsTitle: "Dokumen tersimpan",
        documentsIntro:
          "Anda dapat menghapus dokumen kapan saja dari tab Dokumen di setiap transaksi. Berkas dihapus permanen; hanya catatan audit yang tersisa.",
        stored: "Dokumen tersimpan",
        storedSize: "Ukuran total",
        deleted: "Dokumen dihapus",
        retentionTitle: "Retensi & lokasi data",
        dataLocation: "Lokasi penyimpanan data",
        retentionAfter: "Penghapusan setelah langganan berakhir",
        exportAfter: "Pengiriman salinan data setelah berhenti",
        days: "{n} hari",
        notConfigured: "Belum ditetapkan oleh penyedia layanan",
        retentionNote:
          "Selama langganan aktif, dokumen tidak kami hapus kecuali Anda menghapusnya sendiri atau diwajibkan hukum. Kewajiban menyimpan pembukuan dan dokumen pajak (umumnya 10 tahun menurut UU KUP) tetap menjadi tanggung jawab Anda; simpan salinan Anda sendiri.",
        subprocessorsTitle: "Subprocessor (pihak pemroses data)",
        subprocessorsIntro:
          "Pihak ketiga yang memproses data ruang kerja ini untuk menjalankan layanan.",
        subprocessorName: "Nama",
        subprocessorPurpose: "Kegunaan",
        subprocessorLocation: "Lokasi",
        sourcePlatform: "Infrastruktur platform",
        sourceOcr: "OCR pilihan ruang kerja",
        noSubprocessors:
          "Belum ada daftar subprocessor yang ditetapkan penyedia layanan.",
        exportTitle: "Ekspor data ruang kerja",
        exportIntro:
          "Unduh salinan lengkap data ruang kerja (perusahaan, lawan transaksi, transaksi, snapshot pajak, ekspor XML, impor, log audit) dalam format JSON. Berkas dokumen diunduh per transaksi. Unduhan ini tercatat di log audit.",
        exportButton: "Unduh data (JSON)",
        exportOwnerOnly:
          "Hanya Pemilik atau Admin yang dapat mengekspor data ruang kerja.",
        summaryNote:
          "Ringkasan ini membantu Anda memahami pengelolaan data dan tidak menggantikan Syarat Penggunaan serta Kebijakan Privasi.",
        terminationTitle: "Berhenti berlangganan",
        terminationIntro:
          "Setelah masa pemberitahuan {notice} hari, ruang kerja menjadi baca-saja: data masih bisa dilihat dan diekspor, tetapi tidak bisa menambah data baru. {retention}",
        retentionWithDays:
          "Dokumen dan berkas XML dihapus otomatis {days} hari setelah langganan berakhir.",
        retentionNone:
          "Penghapusan otomatis belum dijadwalkan oleh penyedia layanan.",
        terminationRequest: "Ajukan berhenti berlangganan",
        terminationConfirmTitle: "Ajukan berhenti berlangganan?",
        terminationConfirmBody:
          "Layanan tetap aktif sampai tanggal efektif dan Anda dapat membatalkan pengajuan sebelum tanggal itu. Unduh salinan data dan dokumen Anda sebelum dihapus, karena kewajiban penyimpanan dokumen pajak tetap menjadi tanggung jawab Anda.",
        terminationCancel: "Batalkan pengajuan",
        terminationOwnerOnly:
          "Hanya Pemilik ruang kerja yang dapat mengajukan berhenti berlangganan.",
        effectiveOn: "Berlaku mulai",
        purgeOn: "Dokumen dihapus pada",
        purgedOn: "Dihapus pada",
      },
    },
  },
  en: {
    signIn: "Sign in",
    signUp: "Create account",
    signOut: "Sign out",
    email: "Email",
    password: "Password",
    name: "Name",
    passwordHint: "Use 12–128 characters.",
    forgot: "Forgot password",
    reset: "Reset password",
    verify: "Verify email",
    resend: "Resend verification",
    checkEmail:
      "If the request is eligible, instructions will be emailed. Check your inbox and spam folder.",
    verifiedHelp:
      "Open the verification link in your email, then sign in. Expired links can be resent.",
    saved: "Changes saved.",
    failed:
      "The request could not be processed. Check your details, verify your email, or try again later.",
    unavailable:
      "Account services are not configured. An administrator must set up the database and email delivery.",
    busy: "Processing…",
    home: "Home",
    account: "Account & workspaces",
    profile: "Account profile",
    save: "Save",
    workspaces: "Workspaces",
    create: "Create workspace",
    workspaceName: "Workspace name",
    legalName: "Legal entity name",
    select: "Activate",
    noWorkspace: "No active workspace. Create one or accept an invitation.",
    team: "Team",
    invite: "Invite member",
    role: "Role",
    roles: {
      OWNER: "Owner",
      ADMIN: "Admin",
      PREPARER: "Preparer",
      REVIEWER: "Reviewer",
      APPROVER: "Approver",
    },
    revoke: "Revoke access",
    cancel: "Cancel invitation",
    invitations: "Pending invitations",
    noInvites: "No pending invitations.",
    accept: "Accept invitation",
    invitationHelp:
      "Sign in or register with the recipient email, then reopen the invitation link. Invitations expire in 48 hours and can be used once.",
    sessions: "Active sessions",
    currentSession: "This session",
    revokeSession: "End session",
    revokeOthers: "End other sessions",
    unknownDevice: "Unknown device",
    noTransactions:
      "Accounts, workspaces, company profiles, counterparties, manual drafts, imports, tax evaluation and approval, and BPPU XML export are available.",
    confirm: "Confirm this action?",
    forbidden: "Access denied. Your role or membership may have changed.",
    originMismatch:
      "Request rejected because the app address does not match. Open SerenTax at its configured address and try again.",
    invalidCredentials: "Incorrect email or password.",
    emailNotVerified:
      'Email not verified. Open the verification link in your email or resend it via "Verify email".',
    invalidInvite:
      "The invitation is invalid, already used, expired, or addressed to another email.",
    lastOwner: "A workspace must retain at least one owner.",
    conflict:
      "Data changed or this member/invitation already exists. Reload and try again.",
    rateLimited: "Too many requests. Try again later.",
    refresh: "Reload",
    expires: "Expires",
    changedPassword: "Password changed. Please sign in again.",
    settings: {
      subtitle: "Your profile, workspaces, team, roles and account security.",
      noActive: "No active workspace yet",
      yourRole: "Your role",
      tabs: {
        profile: "Profile",
        workspaces: "Workspaces",
        team: "Team",
        roles: "Roles & permissions",
        approval: "Approval",
        support: "Support access",
        security: "Security & sessions",
      },
      profileIntro:
        "Details SerenTax uses to identify you in comments, audit history and approvals.",
      permissionsTitle: "What you can do in this workspace",
      noPermissions: "Select or create a workspace to see your permissions.",
      myWorkspaces: "My workspaces",
      activeBadge: "Active",
      workspaceSettings: "Workspace settings",
      ocrSettingsHint:
        "Choose how documents are read (manual or an OCR provider).",
      billingHint: "License status, quota and usage.",
      members: "Members",
      member: "Member",
      noMembers: "No other members yet.",
      inviteIntro:
        "Invitations are emailed, valid for 48 hours, and only for that email.",
      matrixIntro:
        "This matrix is read directly from the system access policy. Hover the info icons for what each permission and role means.",
      permission: "Permission",
      allowed: "Allowed",
      notAllowed: "Not allowed",
      approvalIntro:
        "Decide whether a transaction's creator may approve it themselves.",
      securityIntro:
        "Manage your password and the devices signed in to your account.",
      device: "Device",
      thisDevice: "This device",
      status: "Status",
      actions: "Actions",
      changeRoleConfirm: "Change this member's role?",
      privacy: {
        tab: "Data & privacy",
        commitmentTitle: "How we use your data",
        commitment1:
          "Your data (transactions, invoices, tax IDs) is processed only to run the service for this workspace and is never sold. Support can view diagnostics only when an Owner/Admin grants recorded, time-limited access.",
        commitment2:
          "SerenTax does not use your data to train or develop AI models. An AI/OCR vendor is approved by the platform only if its terms prohibit using customer data to train models.",
        commitment3:
          "Documents are sent only to platform-approved AI/OCR vendors, and only after an Owner/Admin consents to AI processing; vendors are used only to read and classify document contents. The vendor's processing location is shown in the sub-processor list.",
        commitment4:
          "Tax IDs are stored encrypted, and document access, data exports, XML downloads and deletions are recorded in the workspace audit log.",
        documentsTitle: "Stored documents",
        documentsIntro:
          "You can delete documents at any time from the Documents tab of each transaction. Files are deleted permanently; only an audit record remains.",
        stored: "Stored documents",
        storedSize: "Total size",
        deleted: "Deleted documents",
        retentionTitle: "Retention & data location",
        dataLocation: "Data storage location",
        retentionAfter: "Deletion after the subscription ends",
        exportAfter: "Data copy delivery after cancellation",
        days: "{n} days",
        notConfigured: "Not yet set by the service provider",
        retentionNote:
          "While the subscription is active we do not delete documents unless you delete them yourself or the law requires it. Keeping your books and tax documents (generally 10 years under Indonesia's tax procedures law) remains your responsibility; keep your own copies.",
        subprocessorsTitle: "Sub-processors",
        subprocessorsIntro:
          "Third parties that process this workspace's data to run the service.",
        subprocessorName: "Name",
        subprocessorPurpose: "Purpose",
        subprocessorLocation: "Location",
        sourcePlatform: "Platform infrastructure",
        sourceOcr: "Workspace OCR choice",
        noSubprocessors:
          "The service provider has not published a sub-processor list yet.",
        exportTitle: "Export workspace data",
        exportIntro:
          "Download a complete copy of the workspace data (companies, counterparties, transactions, tax snapshots, XML exports, imports, audit log) as JSON. Document files are downloaded per transaction. The download is recorded in the audit log.",
        exportButton: "Download data (JSON)",
        exportOwnerOnly: "Only Owners or Admins can export workspace data.",
        summaryNote:
          "This summary helps you understand how data is handled and does not replace the Terms of Use and Privacy Policy.",
        terminationTitle: "Cancel subscription",
        terminationIntro:
          "After the {notice}-day notice period the workspace becomes read-only: data can still be viewed and exported, but no new records can be added. {retention}",
        retentionWithDays:
          "Documents and XML files are deleted automatically {days} days after the subscription ends.",
        retentionNone:
          "Automatic deletion has not been scheduled by the service provider yet.",
        terminationRequest: "Request cancellation",
        terminationConfirmTitle: "Request subscription cancellation?",
        terminationConfirmBody:
          "The service stays active until the effective date and you can withdraw the request before then. Download your data and documents before they are deleted, because keeping tax records remains your responsibility.",
        terminationCancel: "Withdraw request",
        terminationOwnerOnly:
          "Only the workspace Owner can request cancellation.",
        effectiveOn: "Effective on",
        purgeOn: "Documents deleted on",
        purgedOn: "Deleted on",
      },
    },
  },
} satisfies Record<
  Locale,
  Record<string, string | Record<string, string | Record<string, string>>>
>;
export function accountError(code: string | undefined, locale: Locale) {
  const t = accountMessages[locale];
  switch (code) {
    case "ORIGIN_MISMATCH":
      return t.originMismatch;
    case "INVALID_EMAIL_OR_PASSWORD":
      return t.invalidCredentials;
    case "EMAIL_NOT_VERIFIED":
      return t.emailNotVerified;
    case "FORBIDDEN":
    case "UNVERIFIED":
    case "UNAUTHENTICATED":
      return t.forbidden;
    case "INVALID_INVITATION":
      return t.invalidInvite;
    case "LAST_OWNER":
      return t.lastOwner;
    case "CONFLICT":
      return t.conflict;
    case "RATE_LIMITED":
      return t.rateLimited;
    case "AUTH_UNAVAILABLE":
    case "SERVICE_UNAVAILABLE":
      return t.unavailable;
    default:
      return t.failed;
  }
}
