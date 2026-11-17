"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { intakeMessages } from "@/i18n/intake";
import { siteMessages } from "@/i18n/site";
import { accountMessages } from "@/i18n/account";
import { can, type Role } from "@/server/workspaces/policy";
import { Button } from "@/components/ui/button";
import { Skeleton, StatusBadge } from "@/components/ui/status";
import { Field, Submit } from "@/components/account/forms";
import { ApiFailure, apiGet, apiPost, formatFailure } from "./client";

type CompanyItem = {
  id: string;
  name: string;
  legalName: string;
  npwpHint: string | null;
  nitkuHint: string | null;
  address: string | null;
  archivedAt: string | null;
};

export function CompaniesView({ locale }: { locale: Locale }) {
  const t = intakeMessages[locale];
  const site = siteMessages[locale];
  const acc = accountMessages[locale];
  const [data, setData] = useState<{
    role: Role;
    companies: CompanyItem[];
  } | null>(null);
  const [noWorkspace, setNoWorkspace] = useState(false);
  const [editing, setEditing] = useState<CompanyItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function load() {
    try {
      const next = await apiGet<{ role: Role; companies: CompanyItem[] }>(
        "/api/companies",
      );
      setData(next);
      setNoWorkspace(false);
    } catch (error) {
      if (error instanceof ApiFailure && error.code === "NO_WORKSPACE")
        setNoWorkspace(true);
      else setFeedback(formatFailure(error, locale));
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    setFeedback("");
    try {
      const company = {
        name: String(fd.get("name") ?? ""),
        legalName: String(fd.get("legalName") ?? ""),
        npwp: String(fd.get("npwp") ?? "") || undefined,
        nitku: String(fd.get("nitku") ?? "") || undefined,
        address: String(fd.get("address") ?? "") || undefined,
      };
      if (editing) {
        await apiPost("/api/companies", {
          action: "update",
          id: editing.id,
          company,
          clearNpwp: fd.get("clearNpwp") === "on",
          clearNitku: fd.get("clearNitku") === "on",
        });
        setEditing(null);
      } else {
        await apiPost("/api/companies", { action: "create", company });
      }
      form.reset();
      await load();
      setFeedback(t.saved);
    } catch (error) {
      setFeedback(formatFailure(error, locale));
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive(id: string) {
    setBusy(true);
    setFeedback("");
    try {
      await apiPost("/api/companies", { action: "archive", id });
      await load();
      setFeedback(t.saved);
    } catch (error) {
      setFeedback(formatFailure(error, locale));
    } finally {
      setBusy(false);
    }
  }

  if (noWorkspace) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">{t.companiesTitle}</h1>
        <p>{acc.noWorkspace}</p>
        <Link className="underline" href={`/${locale}/app/settings`}>
          {site.manageWorkspace}
        </Link>
      </div>
    );
  }
  const canManage = data ? can(data.role, "team.manage") : false;
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">{t.companiesTitle}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {t.companiesIntro}
        </p>
      </header>
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
          {!data.companies.length ? (
            <p className="rounded-md border p-6 text-sm text-muted-foreground">
              {t.noCompanies}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="p-3 font-semibold">{t.companyName}</th>
                    <th className="p-3 font-semibold">{t.legalName}</th>
                    <th className="p-3 font-semibold">NPWP</th>
                    <th className="p-3 font-semibold">NITKU</th>
                    <th className="p-3 font-semibold">{t.status}</th>
                    {canManage && <th className="p-3 font-semibold" />}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.companies.map((c) => (
                    <tr key={c.id}>
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3">
                        {c.legalName}
                        {c.address && (
                          <div className="text-xs text-muted-foreground">
                            {c.address}
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {c.npwpHint ? `•••• ${c.npwpHint}` : t.maskedNone}
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {c.nitkuHint ? `•••• ${c.nitkuHint}` : t.maskedNone}
                      </td>
                      <td className="p-3">
                        <StatusBadge active={!c.archivedAt}>
                          {c.archivedAt ? t.archived : t.active}
                        </StatusBadge>
                      </td>
                      {canManage && (
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() => setEditing(c)}
                            >
                              {t.editCompany}
                            </Button>
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() => toggleArchive(c.id)}
                            >
                              {c.archivedAt ? t.restore : t.archive}
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!canManage ? (
            <p className="text-sm text-muted-foreground">{t.ownerHint}</p>
          ) : (
            <form
              key={editing?.id ?? "new"}
              onSubmit={submit}
              className="max-w-2xl space-y-4 rounded-lg border p-5"
            >
              <h2 className="text-lg font-semibold">
                {editing ? t.editCompany : t.addCompany}
              </h2>
              <Field
                label={t.companyName}
                name="name"
                defaultValue={editing?.name ?? ""}
                minLength={1}
                maxLength={100}
                required
              />
              <Field
                label={t.legalName}
                name="legalName"
                defaultValue={editing?.legalName ?? ""}
                minLength={1}
                maxLength={200}
                required
              />
              <Field
                label={t.npwp}
                name="npwp"
                maxLength={32}
                placeholder={
                  editing?.npwpHint ? `•••• ${editing.npwpHint}` : ""
                }
              />
              {editing?.npwpHint && (
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" name="clearNpwp" />
                  <span>{t.clearNpwp}</span>
                </label>
              )}
              <Field
                label={t.nitku}
                name="nitku"
                maxLength={40}
                placeholder={
                  editing?.nitkuHint ? `•••• ${editing.nitkuHint}` : ""
                }
              />
              {editing?.nitkuHint && (
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" name="clearNitku" />
                  <span>{t.clearNitku}</span>
                </label>
              )}
              <Field
                label={t.address}
                name="address"
                defaultValue={editing?.address ?? ""}
                maxLength={500}
              />
              <div className="flex flex-wrap gap-3">
                <Submit busy={busy}>
                  {editing ? t.editCompany : t.addCompany}
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
