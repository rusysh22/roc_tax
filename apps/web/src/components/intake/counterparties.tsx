"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { intakeMessages } from "@/i18n/intake";
import { siteMessages } from "@/i18n/site";
import { accountMessages } from "@/i18n/account";
import { identityTypes, type IdentityType } from "@/lib/intake/identity";
import { counterpartyKinds } from "@/lib/intake/schemas";
import type { Role } from "@/server/workspaces/policy";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/status";
import { Field, Submit } from "@/components/account/forms";
import { ApiFailure, apiGet, apiPost, formatFailure } from "./client";

type CounterpartyItem = {
  id: string;
  kind: (typeof counterpartyKinds)[number];
  name: string;
  identityType: IdentityType;
  identityHint: string | null;
  countryCode: string;
  address: string | null;
};

export function CounterpartiesView({ locale }: { locale: Locale }) {
  const t = intakeMessages[locale];
  const site = siteMessages[locale];
  const acc = accountMessages[locale];
  const [data, setData] = useState<{
    role: Role;
    total: number;
    counterparties: CounterpartyItem[];
  } | null>(null);
  const [query, setQuery] = useState("");
  const [noWorkspace, setNoWorkspace] = useState(false);
  const [editing, setEditing] = useState<CounterpartyItem | null>(null);
  const [identityType, setIdentityType] = useState<IdentityType>("NPWP");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function load(search = query) {
    try {
      const qs = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const next = await apiGet<{
        role: Role;
        total: number;
        counterparties: CounterpartyItem[];
      }>(`/api/counterparties${qs}`);
      setData(next);
      setNoWorkspace(false);
    } catch (error) {
      if (error instanceof ApiFailure && error.code === "NO_WORKSPACE")
        setNoWorkspace(true);
      else setFeedback(formatFailure(error, locale));
    }
  }
  useEffect(() => {
    void load("");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    setFeedback("");
    try {
      const counterparty = {
        kind: String(fd.get("kind") ?? "VENDOR"),
        name: String(fd.get("name") ?? ""),
        identityType,
        identity:
          identityType === "NONE"
            ? undefined
            : String(fd.get("identity") ?? "") || undefined,
        countryCode: String(fd.get("countryCode") ?? "ID"),
        address: String(fd.get("address") ?? "") || undefined,
      };
      const result = await apiPost<{
        id: string;
        duplicateNames: { id: string; name: string }[];
      }>(
        "/api/counterparties",
        editing
          ? { action: "update", id: editing.id, counterparty }
          : { action: "create", counterparty },
      );
      setEditing(null);
      form.reset();
      await load();
      setFeedback(
        result.duplicateNames.length
          ? `${t.saved} ${t.duplicateNamesNotice}`
          : t.saved,
      );
    } catch (error) {
      setFeedback(formatFailure(error, locale));
    } finally {
      setBusy(false);
    }
  }

  if (noWorkspace) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">{t.counterpartiesTitle}</h1>
        <p>{acc.noWorkspace}</p>
        <Link className="underline" href={`/${locale}/app/settings`}>
          {site.manageWorkspace}
        </Link>
      </div>
    );
  }
  const canEdit = data
    ? ["OWNER", "ADMIN", "PREPARER"].includes(data.role)
    : false;
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">{t.counterpartiesTitle}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {t.counterpartiesIntro}
        </p>
      </header>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void load(query);
        }}
      >
        <Field
          label={t.search}
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={100}
        />
        <Button type="submit" variant="outline">
          {t.filter}
        </Button>
      </form>
      {feedback && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border p-3 text-sm"
        >
          {feedback}
        </p>
      )}
      {!data ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <>
          {!data.counterparties.length ? (
            <p className="rounded-md border p-6 text-sm text-muted-foreground">
              {t.noCounterparties}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="p-3 font-semibold">{t.counterpartyName}</th>
                    <th className="p-3 font-semibold">{t.kind}</th>
                    <th className="p-3 font-semibold">{t.identityType}</th>
                    <th className="p-3 font-semibold">{t.countryCode}</th>
                    {canEdit && <th className="p-3 font-semibold" />}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.counterparties.map((cp) => (
                    <tr key={cp.id}>
                      <td className="p-3 font-medium">
                        {cp.name}
                        {cp.address && (
                          <div className="text-xs text-muted-foreground">
                            {cp.address}
                          </div>
                        )}
                      </td>
                      <td className="p-3">{t.kinds[cp.kind]}</td>
                      <td className="p-3 font-mono text-xs">
                        {t.identityTypes[cp.identityType]}
                        {cp.identityHint ? ` · •••• ${cp.identityHint}` : ""}
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {cp.countryCode}
                      </td>
                      {canEdit && (
                        <td className="p-3">
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              setEditing(cp);
                              setIdentityType(cp.identityType);
                            }}
                          >
                            {t.editCounterparty}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!canEdit ? (
            <p className="text-sm text-muted-foreground">
              {t.preparerOrManagerHint}
            </p>
          ) : (
            <form
              key={editing?.id ?? "new"}
              onSubmit={submit}
              className="max-w-2xl space-y-4 rounded-lg border p-5"
            >
              <h2 className="text-lg font-semibold">
                {editing ? t.editCounterparty : t.addCounterparty}
              </h2>
              <Field
                label={t.counterpartyName}
                name="name"
                defaultValue={editing?.name ?? ""}
                minLength={1}
                maxLength={200}
                required
              />
              <label className="block space-y-2 text-sm font-medium">
                <span>{t.kind}</span>
                <select
                  name="kind"
                  defaultValue={editing?.kind ?? "VENDOR"}
                  className="min-h-11 w-full rounded-md border bg-background px-3"
                >
                  {counterpartyKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {t.kinds[kind]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm font-medium">
                <span>{t.identityType}</span>
                <select
                  name="identityType"
                  value={identityType}
                  onChange={(event) =>
                    setIdentityType(event.target.value as IdentityType)
                  }
                  className="min-h-11 w-full rounded-md border bg-background px-3"
                >
                  {identityTypes.map((kind) => (
                    <option key={kind} value={kind}>
                      {t.identityTypes[kind]}
                    </option>
                  ))}
                </select>
              </label>
              {identityType !== "NONE" && (
                <Field
                  label={t.identityValue}
                  name="identity"
                  maxLength={64}
                  required={
                    !editing ||
                    editing.identityType !== identityType ||
                    !editing.identityHint
                  }
                  placeholder={
                    editing?.identityHint ? t.identityKeepHint : undefined
                  }
                />
              )}
              <Field
                label={t.countryCode}
                name="countryCode"
                defaultValue={editing?.countryCode ?? "ID"}
                minLength={2}
                maxLength={2}
                required
              />
              <Field
                label={t.address}
                name="address"
                defaultValue={editing?.address ?? ""}
                maxLength={500}
              />
              <div className="flex flex-wrap gap-3">
                <Submit busy={busy}>
                  {editing ? t.editCounterparty : t.addCounterparty}
                </Submit>
                {editing && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditing(null)}
                  >
                    {site.close}
                  </Button>
                )}
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
