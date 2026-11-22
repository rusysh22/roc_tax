"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Building2,
  Check,
  ChevronRight,
  CreditCard,
  KeyRound,
  LogOut,
  Minus,
  ScanText,
  UserPlus,
} from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { accountError, accountMessages } from "@/i18n/account";
import { billingMessages } from "@/i18n/billing";
import { codeEntry, codeLabel, codeOptions } from "@/i18n/codes";
import { formatDate } from "@/i18n/format";
import { ocrMessages } from "@/i18n/ocr";
import { taxMessages } from "@/i18n/tax";
import { viewMessages } from "@/i18n/views";
import {
  can,
  canAssign,
  permissionList,
  rolePermissions,
  roles,
  type Role,
} from "@/server/workspaces/policy";
import {
  segregationPolicies,
  type SegregationPolicy,
} from "@/lib/intake/tax-rules";
import { Button } from "@/components/ui/button";
import { CodeBadge } from "@/components/ui/code-badge";
import { Combobox } from "@/components/ui/combobox";
import { FormField, ReadValue, TextInput } from "@/components/ui/field";
import { Badge, Skeleton } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { InfoTip } from "@/components/ui/tooltip";
import { comboLabels } from "@/components/views/page-state";
import { PagedFooter, usePaged } from "@/components/views/paged";
import { SupportAccessPanel } from "@/components/reports/support-access-panel";
import { cn } from "@/lib/utils";
import { Submit, post } from "./forms";
import { PrivacyPanel } from "./privacy-panel";
import { TrialStrip } from "./trial-strip";

type Snapshot = {
  workspaces: { id: string; name: string; role: Role }[];
  active: null | {
    id: string;
    name: string;
    legalName: string;
    role: Role;
    members: {
      id: string;
      role: Role;
      user: { name: string; email: string };
    }[];
    invitations: { id: string; email: string; role: Role; expiresAt: string }[];
  };
};
type DeviceSession = {
  id: string;
  token: string;
  userAgent?: string;
  expiresAt: string;
};

/** Section inside a tab: title line + optional intro, then content. */
function Section({
  title,
  intro,
  actions,
  children,
}: {
  title: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-2">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold">{title}</h2>
          {intro && <p className="text-sm text-muted-foreground">{intro}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** Standard "line" table used for members, invitations and sessions. */
function LineTable({
  head,
  children,
  footer,
}: {
  head: ReactNode[];
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-surface-2 text-xs text-muted-foreground">
            <tr className="border-b">
              {head.map((cell, index) => (
                <th
                  key={index}
                  scope="col"
                  className={cn(
                    "px-3 py-2.5 text-left font-semibold whitespace-nowrap",
                    index === head.length - 1 && "text-right",
                  )}
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">{children}</tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}

export function Workspace({
  locale,
  userName,
  email,
  currentSessionId,
}: {
  locale: Locale;
  userName: string;
  email: string;
  currentSessionId: string;
}) {
  const t = accountMessages[locale];
  const st = t.settings;
  const v = viewMessages[locale];
  const tax = taxMessages[locale];
  const labels = comboLabels(locale);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(userName);
  const [inviteRole, setInviteRole] = useState<Role>("PREPARER");
  const [segregationPolicy, setSegregationPolicy] =
    useState<SegregationPolicy>("STRICT_SEPARATION");
  const sessionsPage = usePaged(sessions);

  async function load() {
    const [workspaces, devices] = await Promise.all([
      fetch("/api/workspaces", { cache: "no-store" }),
      fetch("/api/auth/list-sessions", { cache: "no-store" }),
    ]);
    if (workspaces.status === 401 || devices.status === 401) {
      window.location.assign(`/${locale}/auth/sign-in`);
      return;
    }
    if (!workspaces.ok || !devices.ok) throw new Error("SERVICE_UNAVAILABLE");
    const wsJson = (await workspaces.json()) as Snapshot;
    setSnapshot(wsJson);
    setSessions(await devices.json());
    if (wsJson.active) {
      const taxPolicyRes = await fetch("/api/tax/policy", {
        cache: "no-store",
      });
      if (taxPolicyRes.ok) {
        const policyJson = (await taxPolicyRes.json()) as {
          segregationPolicy: SegregationPolicy;
        };
        setSegregationPolicy(policyJson.segregationPolicy);
      }
    }
  }
  useEffect(() => {
    let active = true;
    load()
      .catch(() => {
        if (active) setMessage(t.unavailable);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // Locale changes remount this route; refreshing always revalidates server membership.
  }, []);
  async function run(
    action: () => Promise<unknown>,
    confirmText: string | false = false,
  ) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMessage("");
    try {
      await action();
      await load();
      window.dispatchEvent(new Event("serentax:workspaces-changed"));
      setMessage(t.saved);
    } catch (error) {
      setSnapshot(null);
      setMessage(
        accountError(
          error instanceof Error ? error.message : undefined,
          locale,
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  const command = (data: unknown, confirmText: string | false = false) =>
    run(() => post("/api/workspaces", data), confirmText);
  function form(
    event: FormEvent<HTMLFormElement>,
    action: (data: FormData) => void,
  ) {
    event.preventDefault();
    action(new FormData(event.currentTarget));
  }

  const active = snapshot?.active ?? null;
  const manages = active ? can(active.role, "team.manage") : false;
  const assignable = (current?: Role) =>
    codeOptions(
      locale,
      "role",
      roles.filter(
        (role) =>
          role === current || (active ? canAssign(active.role, role) : false),
      ),
    );

  /* ---------- Tab: profile ---------- */
  const profileTab = (
    <div className="space-y-8">
      <Section title={t.profile} intro={st.profileIntro}>
        <form
          className="grid max-w-2xl gap-y-3"
          onSubmit={(e) =>
            form(e, () => {
              void run(() => post("/api/auth/update-user", { name }));
            })
          }
        >
          <FormField field="user.name" label={t.name} required layout="inline">
            <TextInput
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={100}
            />
          </FormField>
          <FormField field="user.email" label={t.email} layout="inline">
            <ReadValue className="break-all">{email}</ReadValue>
          </FormField>
          <FormField field="member.role" label={st.yourRole} layout="inline">
            <ReadValue>
              {active ? (
                <CodeBadge domain="role" code={active.role} />
              ) : (
                st.noActive
              )}
            </ReadValue>
          </FormField>
          <div className="flex justify-end">
            <Submit busy={busy}>{t.save}</Submit>
          </div>
        </form>
      </Section>
      <Section title={st.permissionsTitle}>
        {active ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {permissionList.map((permission) => {
              const entry = codeEntry(locale, "permission", permission);
              const allowed = rolePermissions[active.role].includes(permission);
              return (
                <li
                  key={permission}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
                    allowed
                      ? "border-success/40 bg-success-soft"
                      : "opacity-60",
                  )}
                >
                  {allowed ? (
                    <Check
                      aria-label={st.allowed}
                      className="mt-0.5 size-4 shrink-0 text-success"
                    />
                  ) : (
                    <Minus
                      aria-label={st.notAllowed}
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    />
                  )}
                  <span className="min-w-0 space-y-0.5">
                    <span className="block font-medium">{entry.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {entry.help}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{st.noPermissions}</p>
        )}
      </Section>
      <TrialStrip locale={locale} />
    </div>
  );

  /* ---------- Tab: workspaces ---------- */
  const workspacesTab = (
    <div className="space-y-8">
      <Section title={st.myWorkspaces}>
        {!active && (
          <p className="text-sm text-muted-foreground">{t.noWorkspace}</p>
        )}
        {snapshot && snapshot.workspaces.length > 0 && (
          <LineTable head={[t.workspaceName, st.yourRole, st.actions]}>
            {snapshot.workspaces.map((workspace) => (
              <tr key={workspace.id}>
                <td className="px-3 py-2.5 font-medium">
                  <span className="inline-flex items-center gap-2">
                    {workspace.name}
                    {workspace.id === active?.id && (
                      <Badge tone="green" dot>
                        {st.activeBadge}
                      </Badge>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <CodeBadge domain="role" code={workspace.role} info={false} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={workspace.id === active?.id}
                    onClick={() =>
                      command({
                        action: "select",
                        organizationId: workspace.id,
                      })
                    }
                  >
                    {t.select}
                  </Button>
                </td>
              </tr>
            ))}
          </LineTable>
        )}
      </Section>
      {active && manages && (
        <Section title={st.workspaceSettings}>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                href: `/${locale}/app/settings/ocr`,
                icon: <ScanText aria-hidden="true" className="size-5" />,
                title: ocrMessages[locale].settingsLink,
                hint: st.ocrSettingsHint,
              },
              {
                href: `/${locale}/app/settings/billing`,
                icon: <CreditCard aria-hidden="true" className="size-5" />,
                title: billingMessages[locale].orgTitle,
                hint: st.billingHint,
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-3 rounded-lg border p-4 transition-colors hover:border-primary hover:bg-info-soft"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info-fg">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {item.hint}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 text-muted-foreground group-hover:text-primary"
                />
              </Link>
            ))}
          </div>
        </Section>
      )}
      <Section title={t.create}>
        <form
          className="grid max-w-2xl gap-y-3"
          onSubmit={(e) =>
            form(e, (data) => {
              void command({
                action: "create",
                name: data.get("name"),
                legalName: data.get("legalName"),
              });
            })
          }
        >
          <FormField
            field="workspace.name"
            label={t.workspaceName}
            required
            layout="inline"
          >
            <TextInput name="name" minLength={2} maxLength={100} />
          </FormField>
          <FormField
            field="workspace.legalName"
            label={t.legalName}
            required
            layout="inline"
          >
            <TextInput name="legalName" minLength={2} maxLength={200} />
          </FormField>
          <div className="flex justify-end">
            <Submit busy={busy}>
              <Building2 aria-hidden="true" />
              <span>{t.create}</span>
            </Submit>
          </div>
        </form>
      </Section>
    </div>
  );

  /* ---------- Tab: team (managers only) ---------- */
  const teamTab = active && (
    <div className="space-y-8">
      <Section title={t.team}>
        <LineTable head={[st.member, t.email, t.role, st.actions]}>
          {active.members.map((member) => {
            const editable = canAssign(active.role, member.role);
            return (
              <tr key={member.id}>
                <td className="px-3 py-2.5 font-medium">{member.user.name}</td>
                <td className="px-3 py-2.5 break-all text-muted-foreground">
                  {member.user.email}
                </td>
                <td className="w-56 px-3 py-2">
                  {editable ? (
                    <Combobox
                      aria-label={`${t.role}: ${member.user.name}`}
                      value={member.role}
                      onChange={(value) => {
                        if (value && value !== member.role)
                          void command(
                            {
                              action: "role",
                              memberId: member.id,
                              role: value,
                            },
                            st.changeRoleConfirm,
                          );
                      }}
                      options={assignable(member.role)}
                      labels={labels}
                    />
                  ) : (
                    <CodeBadge domain="role" code={member.role} />
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {editable && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        command(
                          { action: "revoke", memberId: member.id },
                          t.confirm,
                        )
                      }
                    >
                      {t.revoke}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </LineTable>
      </Section>
      <Section title={t.invite} intro={st.inviteIntro}>
        <form
          className="grid max-w-2xl gap-y-3"
          onSubmit={(e) =>
            form(e, (data) => {
              void command({
                action: "invite",
                email: data.get("email"),
                role: inviteRole,
                locale,
              });
            })
          }
        >
          <FormField
            field="member.email"
            label={t.email}
            required
            layout="inline"
          >
            <TextInput name="email" type="email" maxLength={254} />
          </FormField>
          <FormField
            field="member.role"
            label={t.role}
            required
            layout="inline"
          >
            <Combobox
              value={inviteRole}
              onChange={(value) => value && setInviteRole(value as Role)}
              options={assignable()}
              labels={labels}
            />
          </FormField>
          <div className="flex justify-end">
            <Submit busy={busy}>
              <UserPlus aria-hidden="true" />
              <span>{t.invite}</span>
            </Submit>
          </div>
        </form>
      </Section>
      <Section title={t.invitations}>
        {!active.invitations.length ? (
          <p className="text-sm text-muted-foreground">{t.noInvites}</p>
        ) : (
          <LineTable head={[t.email, t.role, t.expires, st.actions]}>
            {active.invitations.map((invite) => (
              <tr key={invite.id}>
                <td className="px-3 py-2.5 break-all">{invite.email}</td>
                <td className="px-3 py-2.5">
                  <CodeBadge domain="role" code={invite.role} info={false} />
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {formatDate(new Date(invite.expiresAt), locale)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {canAssign(active.role, invite.role) && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        command(
                          { action: "cancel", invitationId: invite.id },
                          t.confirm,
                        )
                      }
                    >
                      {t.cancel}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </LineTable>
        )}
      </Section>
    </div>
  );

  /* ---------- Tab: roles matrix (everyone) ---------- */
  const rolesTab = (
    <Section title={st.tabs.roles} intro={st.matrixIntro}>
      <div className="overflow-hidden rounded-lg border">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-surface-2 text-xs">
              <tr className="border-b">
                <th
                  scope="col"
                  className="px-3 py-2.5 text-left font-semibold text-muted-foreground"
                >
                  {st.permission}
                </th>
                {roles.map((role) => {
                  const entry = codeEntry(locale, "role", role);
                  return (
                    <th
                      key={role}
                      scope="col"
                      className="px-3 py-2.5 text-center"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Badge tone={entry.tone}>{entry.label}</Badge>
                        <InfoTip
                          functional={entry.help}
                          technical={role}
                          label={`${v.information}: ${entry.label}`}
                          technicalLabel={v.technicalName}
                        />
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y">
              {permissionList.map((permission) => {
                const entry = codeEntry(locale, "permission", permission);
                return (
                  <tr key={permission}>
                    <th
                      scope="row"
                      className="px-3 py-2.5 text-left font-medium"
                    >
                      <span className="inline-flex items-center gap-1">
                        {entry.label}
                        <InfoTip
                          functional={entry.help}
                          technical={permission}
                          label={`${v.information}: ${entry.label}`}
                          technicalLabel={v.technicalName}
                        />
                      </span>
                    </th>
                    {roles.map((role) => {
                      const allowed =
                        rolePermissions[role].includes(permission);
                      return (
                        <td
                          key={role}
                          className={cn(
                            "px-3 py-2.5 text-center",
                            active?.role === role && "bg-info-soft/60",
                          )}
                        >
                          {allowed ? (
                            <Check
                              aria-label={`${codeLabel(locale, "role", role)}: ${st.allowed}`}
                              className="mx-auto size-4 text-success"
                            />
                          ) : (
                            <Minus
                              aria-label={`${codeLabel(locale, "role", role)}: ${st.notAllowed}`}
                              className="mx-auto size-4 text-subtle-foreground"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );

  /* ---------- Tab: approval policy (managers) ---------- */
  const approvalTab = (
    <Section title={tax.segregationTitle} intro={st.approvalIntro}>
      <form
        className="max-w-2xl space-y-4"
        onSubmit={(e) =>
          form(e, () => {
            void run(() => post("/api/tax/policy", { segregationPolicy }));
          })
        }
      >
        <fieldset className="space-y-2">
          <legend className="sr-only">{tax.segregationTitle}</legend>
          {segregationPolicies.map((policy) => {
            const entry = codeEntry(locale, "segregationPolicy", policy);
            const checked = segregationPolicy === policy;
            return (
              <label
                key={policy}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                  checked
                    ? "border-primary bg-info-soft"
                    : "hover:bg-surface-2",
                )}
              >
                <input
                  type="radio"
                  name="segregationPolicy"
                  value={policy}
                  checked={checked}
                  onChange={() => setSegregationPolicy(policy)}
                  className="mt-1 accent-[var(--primary)]"
                />
                <span className="space-y-1">
                  <span className="flex items-center gap-2 font-medium">
                    {entry.label}
                    <Badge tone={entry.tone} dot>
                      {policy === "STRICT_SEPARATION" ? "✓" : "!"}
                    </Badge>
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {entry.help}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <div className="flex justify-end">
          <Submit busy={busy}>{tax.savePolicy}</Submit>
        </div>
      </form>
    </Section>
  );

  /* ---------- Tab: security & sessions ---------- */
  const securityTab = (
    <div className="space-y-8">
      <Section
        title={t.sessions}
        intro={st.securityIntro}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/${locale}/auth/forgot`}>
                <KeyRound aria-hidden="true" />
                <span>{t.reset}</span>
              </Link>
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() =>
                run(() => post("/api/auth/revoke-other-sessions"), t.confirm)
              }
            >
              <LogOut aria-hidden="true" />
              <span>{t.revokeOthers}</span>
            </Button>
          </div>
        }
      >
        <LineTable
          head={[st.device, t.expires, st.actions]}
          footer={<PagedFooter paged={sessionsPage} v={v} />}
        >
          {sessionsPage.rows.map((session) => {
            const current = session.id === currentSessionId;
            return (
              <tr key={session.id}>
                <td className="max-w-md px-3 py-2.5 break-all">
                  {current ? (
                    <span className="inline-flex items-center gap-2 font-medium">
                      {t.currentSession}
                      <Badge tone="green" dot>
                        {st.thisDevice}
                      </Badge>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {session.userAgent || t.unknownDevice}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {formatDate(new Date(session.expiresAt), locale)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {!current && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        run(
                          () =>
                            post("/api/auth/revoke-session", {
                              token: session.token,
                            }),
                          t.confirm,
                        )
                      }
                    >
                      {t.revokeSession}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </LineTable>
      </Section>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{t.account}</h1>
            <p className="text-sm text-muted-foreground">{st.subtitle}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => run(load)}
          >
            {t.refresh}
          </Button>
        </div>
        <p
          data-testid="account-feedback"
          role="status"
          aria-live="polite"
          className={cn(
            "min-h-5 text-sm",
            message === t.saved
              ? "font-medium text-success-fg"
              : "text-muted-foreground",
          )}
        >
          {busy || loading ? t.busy : message}
        </p>
        {/* Header: who you are in which workspace. */}
        <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-surface p-5 shadow-xs">
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-white uppercase"
          >
            {(name || email).trim().slice(0, 2)}
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate font-semibold">{name || email}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
          </div>
          <div className="min-w-0 space-y-1 text-right">
            {loading ? (
              <Skeleton className="h-5 w-40" />
            ) : active ? (
              <>
                <h2 className="truncate font-semibold">{active.name}</h2>
                <p className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{active.legalName}</span>
                  <CodeBadge domain="role" code={active.role} />
                </p>
              </>
            ) : (
              <p className="max-w-xs text-sm text-muted-foreground">
                {t.noWorkspace}
              </p>
            )}
          </div>
        </div>
        <fieldset
          disabled={busy}
          className="min-w-0 rounded-xl border bg-surface p-4 shadow-xs sm:p-6"
        >
          <Tabs
            label={t.account}
            items={[
              { id: "profile", label: st.tabs.profile, content: profileTab },
              {
                id: "workspaces",
                label: st.tabs.workspaces,
                content: workspacesTab,
              },
              {
                id: "team",
                label: st.tabs.team,
                badge: active ? active.members.length : undefined,
                content: teamTab,
                hidden: !manages,
              },
              { id: "roles", label: st.tabs.roles, content: rolesTab },
              {
                id: "approval",
                label: st.tabs.approval,
                content: approvalTab,
                hidden: !manages,
              },
              {
                id: "support",
                label: st.tabs.support,
                content: <SupportAccessPanel locale={locale} />,
                hidden: !manages,
              },
              {
                id: "privacy",
                label: st.privacy.tab,
                content: <PrivacyPanel locale={locale} />,
                hidden: !active,
              },
              {
                id: "security",
                label: st.tabs.security,
                content: securityTab,
              },
            ]}
          />
        </fieldset>
      </div>
    </div>
  );
}
