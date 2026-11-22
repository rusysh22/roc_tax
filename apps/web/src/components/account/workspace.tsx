"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { accountError, accountMessages } from "@/i18n/account";
import { formatDate } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import { can, canAssign, roles, type Role } from "@/server/workspaces/policy";
import { billingMessages } from "@/i18n/billing";
import { ocrMessages } from "@/i18n/ocr";
import { taxMessages } from "@/i18n/tax";
import { SupportAccessPanel } from "@/components/reports/support-access-panel";
import {
  segregationPolicies,
  type SegregationPolicy,
} from "@/lib/intake/tax-rules";
import { Field, Submit, post } from "./forms";
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
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [segregationPolicy, setSegregationPolicy] =
    useState<SegregationPolicy>("STRICT_SEPARATION");
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
  async function run(action: () => Promise<unknown>, confirm = false) {
    if (confirm && !window.confirm(t.confirm)) return;
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
  const command = (data: unknown, confirm = false) =>
    run(() => post("/api/workspaces", data), confirm);
  function form(
    event: FormEvent<HTMLFormElement>,
    action: (data: FormData) => void,
  ) {
    event.preventDefault();
    action(new FormData(event.currentTarget));
  }
  const active = snapshot?.active;
  const roleSelect = (name: string, defaultValue: Role = "PREPARER") => (
    <label className="block space-y-2 text-sm">
      <span>{t.role}</span>
      <select
        aria-label={t.role}
        name={name}
        defaultValue={defaultValue}
        className="field-control w-auto"
      >
        {roles
          .filter((role) => active && canAssign(active.role, role))
          .map((role) => (
            <option key={role} value={role}>
              {t.roles[role]}
            </option>
          ))}
      </select>
    </label>
  );
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{t.account}</h1>
        <TrialStrip locale={locale} />
        <p className="rounded-lg border bg-surface-2 px-4 py-3 text-sm text-muted-foreground">
          {t.noTransactions}
        </p>
        <p data-testid="account-feedback" role="status" aria-live="polite">
          {busy || loading ? t.busy : message}
        </p>
        <Button variant="outline" disabled={busy} onClick={() => run(load)}>
          {t.refresh}
        </Button>
        <fieldset disabled={busy} className="space-y-6">
          <section className="space-y-4 rounded-xl border bg-surface p-5 shadow-xs sm:p-6">
            <h2 className="text-lg font-semibold">{t.profile}</h2>
            <p className="break-all">{email}</p>
            <form
              className="flex flex-wrap items-end gap-4"
              onSubmit={(e) =>
                form(e, (data) => {
                  void run(() =>
                    post("/api/auth/update-user", { name: data.get("name") }),
                  );
                })
              }
            >
              <Field
                label={t.name}
                name="name"
                defaultValue={userName}
                minLength={2}
                maxLength={100}
                required
              />
              <Submit busy={busy}>{t.save}</Submit>
            </form>
            <Link className="underline" href={`/${locale}/auth/forgot`}>
              {t.reset}
            </Link>
          </section>
          <section className="space-y-4 rounded-xl border bg-surface p-5 shadow-xs sm:p-6">
            <h2 className="text-lg font-semibold">{t.workspaces}</h2>
            {!active && <p>{t.noWorkspace}</p>}
            <ul className="space-y-3">
              {snapshot?.workspaces.map((workspace) => (
                <li
                  key={workspace.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4"
                >
                  <span>
                    {workspace.name} · {t.roles[workspace.role]}
                  </span>
                  <Button
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
                </li>
              ))}
            </ul>
            <form
              className="space-y-4 rounded-md border p-5"
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
              <h3 className="font-semibold">{t.create}</h3>
              <Field
                label={t.workspaceName}
                name="name"
                minLength={2}
                maxLength={100}
                required
              />
              <Field
                label={t.legalName}
                name="legalName"
                minLength={2}
                maxLength={200}
                required
              />
              <Submit busy={busy}>{t.create}</Submit>
            </form>
          </section>
          {active && (
            <section className="space-y-4 rounded-xl border bg-surface p-5 shadow-xs sm:p-6">
              <h2 className="break-words text-lg font-semibold">
                {active.name}
              </h2>
              <p>
                {active.legalName} · {t.roles[active.role]} ·{" "}
                <Link
                  className="underline"
                  href={`/${locale}/app/settings/ocr`}
                >
                  {ocrMessages[locale].settingsLink}
                </Link>{" "}
                ·{" "}
                <Link
                  className="underline"
                  href={`/${locale}/app/settings/billing`}
                >
                  {billingMessages[locale].orgTitle}
                </Link>
              </p>
              {can(active.role, "team.manage") && (
                <>
                  <form
                    className="space-y-3 rounded-md border p-4"
                    onSubmit={(e) =>
                      form(e, () => {
                        void run(() =>
                          post("/api/tax/policy", { segregationPolicy }),
                        );
                      })
                    }
                  >
                    <h3 className="font-semibold">
                      {taxMessages[locale].segregationTitle}
                    </h3>
                    <select
                      aria-label={taxMessages[locale].segregationTitle}
                      value={segregationPolicy}
                      onChange={(e) =>
                        setSegregationPolicy(
                          e.target.value as SegregationPolicy,
                        )
                      }
                      className="field-control"
                    >
                      {segregationPolicies.map((p) => (
                        <option key={p} value={p}>
                          {taxMessages[locale].segregationPolicies[p]}
                        </option>
                      ))}
                    </select>
                    <Submit busy={busy}>
                      {taxMessages[locale].savePolicy}
                    </Submit>
                  </form>
                  <SupportAccessPanel locale={locale} />
                  <h3 className="font-semibold">{t.team}</h3>
                  <ul className="space-y-4">
                    {active.members.map((member) => (
                      <li
                        key={member.id}
                        className="space-y-3 rounded-md border p-4"
                      >
                        <p className="break-words">
                          {member.user.name} · {member.user.email} ·{" "}
                          {t.roles[member.role]}
                        </p>
                        {canAssign(active.role, member.role) && (
                          <div className="flex flex-wrap items-end gap-4">
                            <form
                              className="flex items-end gap-3"
                              onSubmit={(e) =>
                                form(e, (data) => {
                                  void command(
                                    {
                                      action: "role",
                                      memberId: member.id,
                                      role: data.get("role"),
                                    },
                                    true,
                                  );
                                })
                              }
                            >
                              {roleSelect("role", member.role)}
                              <Submit busy={busy}>{t.save}</Submit>
                            </form>
                            <Button
                              variant="outline"
                              onClick={() =>
                                command(
                                  { action: "revoke", memberId: member.id },
                                  true,
                                )
                              }
                            >
                              {t.revoke}
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  <form
                    className="space-y-4 rounded-md border p-5"
                    onSubmit={(e) =>
                      form(e, (data) => {
                        void command({
                          action: "invite",
                          email: data.get("email"),
                          role: data.get("role"),
                          locale,
                        });
                      })
                    }
                  >
                    <h3 className="font-semibold">{t.invite}</h3>
                    <Field
                      label={t.email}
                      name="email"
                      type="email"
                      required
                      maxLength={254}
                    />
                    {roleSelect("role")}
                    <Submit busy={busy}>{t.invite}</Submit>
                  </form>
                  <h3 className="font-semibold">{t.invitations}</h3>
                  {!active.invitations.length && <p>{t.noInvites}</p>}
                  <ul className="space-y-3">
                    {active.invitations.map((invite) => (
                      <li
                        key={invite.id}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-md border p-4"
                      >
                        <span className="break-all">
                          {invite.email} · {t.roles[invite.role]}
                          <br />
                          {t.expires}:{" "}
                          {formatDate(new Date(invite.expiresAt), locale)}
                        </span>
                        {canAssign(active.role, invite.role) && (
                          <Button
                            variant="outline"
                            onClick={() =>
                              command(
                                { action: "cancel", invitationId: invite.id },
                                true,
                              )
                            }
                          >
                            {t.cancel}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
          <section className="space-y-4 rounded-xl border bg-surface p-5 shadow-xs sm:p-6">
            <h2 className="text-lg font-semibold">{t.sessions}</h2>
            <Button
              variant="outline"
              onClick={() =>
                run(() => post("/api/auth/revoke-other-sessions"), true)
              }
            >
              {t.revokeOthers}
            </Button>
            <ul className="space-y-3">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-md border p-4"
                >
                  <span className="max-w-xl break-all text-sm">
                    {session.id === currentSessionId
                      ? t.currentSession
                      : session.userAgent || t.unknownDevice}
                    <br />
                    {t.expires}:{" "}
                    {formatDate(new Date(session.expiresAt), locale)}
                  </span>
                  {session.id !== currentSessionId && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        run(
                          () =>
                            post("/api/auth/revoke-session", {
                              token: session.token,
                            }),
                          true,
                        )
                      }
                    >
                      {t.revokeSession}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </fieldset>
      </div>
    </div>
  );
}
