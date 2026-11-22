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
