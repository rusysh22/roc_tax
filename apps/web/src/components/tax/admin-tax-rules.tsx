"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BadgeCheck,
  ClipboardCheck,
  FlaskConical,
  PencilLine,
} from "lucide-react";
import { codeLabel, codeOptions } from "@/i18n/codes";
import { CodeBadge } from "@/components/ui/code-badge";
import type { Locale } from "@/i18n/messages";
import { taxMessages } from "@/i18n/tax";
import { intakeMessages } from "@/i18n/intake";
import { shellMessages } from "@/i18n/shell";
import { viewMessages } from "@/i18n/views";
import { documentTypes } from "@/lib/intake/schemas";
import {
  allTaxFamilies,
  formatRationalRate,
  taxRoundingModes,
  type TaxRoundingMode,
  type TaxRuleStatus,
} from "@/lib/intake/tax-rules";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog } from "@/components/ui/dialog";
import {
  Checkbox,
  FieldGroup,
  FormField,
  ReadValue,
  TextInput,
} from "@/components/ui/field";
import { MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Notice } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import {
  FormBody,
  FormPage,
  SheetTitle,
  StatusBar,
} from "@/components/views/form-view";
import {
  ListPage,
  archivedPreset,
  type ListAction,
} from "@/components/views/list-page";
import { comboLabels } from "@/components/views/page-state";
import type { Column } from "@/components/views/list-view";
import type { ViewField } from "@/components/views/search";
import { useResource } from "@/components/views/use-resource";
import {
  ApiFailure,
  apiGet,
  apiPost,
  formatFailure,
} from "@/components/intake/client";

type RuleItem = {
  id: string;
  code: string;
  version: number;
  taxFamily: string;
  documentType: string;
  objectCode: string;
  name: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  rateNumerator: number;
  rateDenominator: number;
  roundingMode: TaxRoundingMode;
  sourceCitation: string;
  catalogStatus: TaxRuleStatus;
  smeReviewedBy: string | null;
};

function ruleError(error: unknown, locale: Locale) {
  if (error instanceof ApiFailure) {
    const map = taxMessages[locale].errors as Record<string, string>;
    if (map[error.code]) return map[error.code];
  }
  return formatFailure(error, locale);
}

function StatusPill({ status }: { status: TaxRuleStatus; locale?: Locale }) {
  return <CodeBadge domain="taxRuleStatus" code={status} />;
}

const setStatus = (
  ruleId: string,
  catalogStatus: TaxRuleStatus,
  smeReviewedBy?: string,
) =>
  apiPost("/api/admin/tax-rules", {
    action: "set_status",
    ruleId,
    catalogStatus,
    smeReviewedBy,
  });

export function TaxRulesList({ locale }: { locale: Locale }) {
  const t = taxMessages[locale];
  const intake = intakeMessages[locale];
  const s = shellMessages[locale];
  const v = viewMessages[locale];
  const { data, reload } = useResource(() =>
    apiGet<{ rules: RuleItem[] }>("/api/admin/tax-rules"),
  );
  const isArchived = (r: RuleItem) => r.catalogStatus === "RETIRED";
  const archive = useMemo(() => archivedPreset(locale, isArchived), [locale]);

  const fields = useMemo<ViewField<RuleItem>[]>(
    () => [
      {
        name: "code",
        label: t.codeLabel,
        type: "text",
        value: (r) => r.code,
        searchable: true,
        sortable: true,
      },
      {
        name: "name",
        label: t.nameLabel,
        type: "text",
        value: (r) => r.name,
        searchable: true,
        sortable: true,
      },
      {
        name: "objectCode",
        label: t.objectCodeLabel,
        type: "text",
        value: (r) => r.objectCode,
        searchable: true,
      },
      {
        name: "status",
        label: intake.status,
        type: "enum",
        value: (r) => r.catalogStatus,
        display: (r) => t.ruleStatuses[r.catalogStatus],
        options: (
          ["DRAFT", "NON_PRODUCTION_TEST", "SME_APPROVED", "RETIRED"] as const
        ).map((st) => ({ value: st, label: t.ruleStatuses[st] })),
        filterable: true,
        groupable: true,
      },
      {
        name: "taxFamily",
        label: t.taxFamilyLabel,
        type: "enum",
        value: (r) => r.taxFamily,
        display: (r) => codeLabel(locale, "taxFamily", r.taxFamily),
        options: codeOptions(locale, "taxFamily", allTaxFamilies),
        filterable: true,
        groupable: true,
      },
      {
        name: "documentType",
        label: intake.documentType,
        type: "enum",
        value: (r) => r.documentType,
        display: (r) =>
          intake.documentTypes[
            r.documentType as keyof typeof intake.documentTypes
          ] ?? r.documentType,
        options: documentTypes.map((d) => ({
          value: d,
          label: intake.documentTypes[d],
        })),
        filterable: true,
      },
      {
        name: "effectiveFrom",
        label: t.effectiveFromLabel,
        type: "date",
        value: (r) => r.effectiveFrom,
        filterable: true,
        sortable: true,
      },
    ],
    [t, intake],
  );

  const columns: Column<RuleItem>[] = [
    {
      key: "code",
      header: t.codeLabel,
      sortField: "code",
      primary: true,
      cell: (r) => (
        <span className="font-mono">
          {r.code} <span className="text-muted-foreground">v{r.version}</span>
        </span>
      ),
    },
    {
      key: "name",
      header: t.nameLabel,
      sortField: "name",
      cell: (r) => r.name,
    },
    {
      key: "family",
      header: t.taxFamilyLabel,
      cell: (r) => (
        <span className="text-xs">
          {codeLabel(locale, "taxFamily", r.taxFamily)}
        </span>
      ),
      hideBelow: "xl",
    },
    {
      key: "object",
      header: t.objectCodeLabel,
      cell: (r) => <span className="font-mono text-xs">{r.objectCode}</span>,
      hideBelow: "lg",
    },
    {
      key: "rate",
      header: t.rateLabel,
      align: "right",
      cell: (r) => (
        <span className="tabular-nums">
          {formatRationalRate(r.rateNumerator, r.rateDenominator)}
        </span>
      ),
    },
    {
      key: "effective",
      header: t.effectiveLabel,
      sortField: "effectiveFrom",
      cell: (r) => (
        <span className="font-mono text-xs whitespace-nowrap">
          {r.effectiveFrom} → {r.effectiveTo ?? "…"}
        </span>
      ),
      hideBelow: "lg",
    },
    {
      key: "status",
      header: intake.status,
      cell: (r) => <StatusPill status={r.catalogStatus} locale={locale} />,
    },
  ];

  const actions: ListAction<RuleItem>[] = [
    {
      id: "retire",
      label: v.archive,
      icon: <Archive />,
      visible: (rows) => rows.some((r) => !isArchived(r)),
      confirm: {
        title: v.confirmArchiveTitle,
        body: v.confirmArchiveBody,
        tone: "warning",
      },
      run: async (rows) => {
        try {
          for (const r of rows.filter((r) => !isArchived(r)))
            await setStatus(r.id, "RETIRED");
          return v.archivedDone;
        } catch (error) {
          throw new Error(ruleError(error, locale), { cause: error });
        }
      },
    },
    {
      id: "draft",
      label: v.unarchive,
      icon: <ArchiveRestore />,
      visible: (rows) => rows.some(isArchived),
      run: async (rows) => {
        for (const r of rows.filter(isArchived)) await setStatus(r.id, "DRAFT");
        return v.unarchivedDone;
      },
    },
  ];

  return (
    <ListPage
      locale={locale}
      title={s.menuTaxRules}
      model="tax-rules"
      fields={fields}
      presets={archive.presets}
      baseline={archive.baseline}
      columns={columns}
      records={data?.rules ?? null}
      getId={(r) => r.id}
      href={(r) => `/${locale}/admin/tax-rules/${r.id}`}
      rowLabel={(r) => `${r.code} v${r.version}`}
      createHref={`/${locale}/admin/tax-rules/new`}
      actions={actions}
      onActionDone={reload}
      emptyIcon={<ClipboardCheck />}
      banner={<Notice>{t.adminRulesIntro}</Notice>}
    />
  );
}

type Draft = {
  code: string;
  version: string;
  taxFamily: string;
  documentType: (typeof documentTypes)[number];
  objectCode: string;
  name: string;
  effectiveFrom: string;
  effectiveTo: string;
  rateNumerator: string;
  rateDenominator: string;
  roundingMode: TaxRoundingMode;
  sourceCitation: string;
  catalogStatus: "DRAFT" | "NON_PRODUCTION_TEST" | "SME_APPROVED";
  smeReviewedBy: string;
  reqIdentity: boolean;
  reqPayroll: boolean;
  reqTreaty: boolean;
};

export function TaxRuleForm({
  locale,
  ruleId,
}: {
  locale: Locale;
  ruleId: string | null;
}) {
  const t = taxMessages[locale];
  const intake = intakeMessages[locale];
  const s = shellMessages[locale];
  const v = viewMessages[locale];
  const router = useRouter();
  const toast = useToast();
  const creating = ruleId === null;
  const { data, reload } = useResource(
    () => apiGet<{ rules: RuleItem[] }>("/api/admin/tax-rules"),
    [ruleId],
  );
  const rule = data?.rules.find((r) => r.id === ruleId) ?? null;
  const [draft, setDraft] = useState<Draft>({
    code: "",
    version: "1",
    taxFamily: "PPH_UNIFIKASI_BPPU",
    documentType: "SUPPLIER_INVOICE",
    objectCode: "",
    name: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: "",
    rateNumerator: "2",
    rateDenominator: "100",
    roundingMode: "HALF_UP",
    sourceCitation: "",
    catalogStatus: "DRAFT",
    smeReviewedBy: "",
    reqIdentity: true,
    reqPayroll: false,
    reqTreaty: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approveDialog, setApproveDialog] = useState(false);
  const [reviewer, setReviewer] = useState("");
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const labels = comboLabels(locale);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const created = await apiPost<{ id: string }>("/api/admin/tax-rules", {
        action: "create",
        code: draft.code,
        version: Number(draft.version),
        taxFamily: draft.taxFamily,
        documentType: draft.documentType,
        objectCode: draft.objectCode,
        name: draft.name,
        effectiveFrom: draft.effectiveFrom,
        effectiveTo: draft.effectiveTo || undefined,
        rateNumerator: Number(draft.rateNumerator),
        rateDenominator: Number(draft.rateDenominator),
        roundingMode: draft.roundingMode,
        requireCounterpartyIdentity: draft.reqIdentity,
        requirePayrollEvidence: draft.reqPayroll,
        requireTreatyEvidence: draft.reqTreaty,
        sourceCitation: draft.sourceCitation,
        catalogStatus: draft.catalogStatus,
        smeReviewedBy: draft.smeReviewedBy || undefined,
      });
      toast.success(v.created);
      router.replace(`/${locale}/admin/tax-rules/${created.id}`);
    } catch (failure) {
      setError(ruleError(failure, locale));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: TaxRuleStatus, smeReviewedBy?: string) {
    if (!rule) return;
    try {
      await setStatus(rule.id, status, smeReviewedBy);
      await reload();
      toast.success(t.saved);
      setApproveDialog(false);
    } catch (failure) {
      toast.error(ruleError(failure, locale));
    }
  }

  const rate =
    Number(draft.rateDenominator) > 0 && Number(draft.rateNumerator) >= 0
      ? formatRationalRate(
          Number(draft.rateNumerator),
          Number(draft.rateDenominator),
        )
      : "—";

  return (
    <FormPage
      locale={locale}
      model="tax-rules"
      breadcrumbs={[
        { label: s.menuTaxRules, href: `/${locale}/admin/tax-rules` },
        {
          label: creating
            ? v.new
            : rule
              ? `${rule.code} v${rule.version}`
              : data
                ? v.notFound
                : "…",
        },
      ]}
      recordId={ruleId ?? undefined}
      hrefFor={(id) => `/${locale}/admin/tax-rules/${id}`}
      mode={creating ? "create" : "read"}
      dirty={creating && (draft.code !== "" || draft.name !== "")}
      saving={saving}
      onDiscard={() => router.push(`/${locale}/admin/tax-rules`)}
      ribbon={
        rule?.catalogStatus === "RETIRED" ? t.ruleStatuses.RETIRED : undefined
      }
      loading={!creating && data === null}
      statusBar={
        rule ? (
          <StatusBar
            steps={(
              ["DRAFT", "NON_PRODUCTION_TEST", "SME_APPROVED"] as const
            ).map((id) => ({ id, label: t.ruleStatuses[id] }))}
            current={rule.catalogStatus}
            label={intake.status}
            buttons={
              rule.catalogStatus !== "SME_APPROVED" &&
              rule.catalogStatus !== "RETIRED" ? (
                <Button
                  type="button"
                  variant="success"
                  onClick={() => setApproveDialog(true)}
                >
                  <BadgeCheck aria-hidden="true" />
                  <span>{t.ruleStatuses.SME_APPROVED}</span>
                </Button>
              ) : undefined
            }
          />
        ) : undefined
      }
      gear={
        rule
          ? (close) => (
              <>
                {rule.catalogStatus !== "NON_PRODUCTION_TEST" && (
                  <MenuItem
                    icon={<FlaskConical />}
                    onSelect={() => {
                      close();
                      void changeStatus("NON_PRODUCTION_TEST");
                    }}
                  >
                    {t.ruleStatuses.NON_PRODUCTION_TEST}
                  </MenuItem>
                )}
                {rule.catalogStatus !== "DRAFT" && (
                  <MenuItem
                    icon={<PencilLine />}
                    onSelect={() => {
                      close();
                      void changeStatus("DRAFT");
                    }}
                  >
                    {t.ruleStatuses.DRAFT}
                  </MenuItem>
                )}
                <MenuSeparator />
                <MenuItem
                  icon={
                    rule.catalogStatus === "RETIRED" ? (
                      <ArchiveRestore />
                    ) : (
                      <Archive />
                    )
                  }
                  onSelect={() => {
                    close();
                    void changeStatus(
                      rule.catalogStatus === "RETIRED" ? "DRAFT" : "RETIRED",
                    );
                  }}
                >
                  {rule.catalogStatus === "RETIRED" ? v.unarchive : v.archive}
                </MenuItem>
              </>
            )
          : undefined
      }
    >
      {!creating && data && !rule ? (
        <p role="alert" className="text-sm">
          {v.notFound}
        </p>
      ) : rule ? (
        <div className="space-y-8">
          <SheetTitle
            label={t.codeLabel}
            aside={<StatusPill status={rule.catalogStatus} locale={locale} />}
          >
            <span className="font-mono">{rule.code}</span>{" "}
            <span className="text-muted-foreground">v{rule.version}</span>
          </SheetTitle>
          <p className="text-base">{rule.name}</p>
          <div className="grid gap-x-12 gap-y-6 lg:grid-cols-2">
            <FieldGroup title={v.information}>
              <FormField
                field="taxRule.taxFamily"
                label={t.taxFamilyLabel}
                layout="inline"
              >
                <ReadValue>
                  {codeLabel(locale, "taxFamily", rule.taxFamily)}
                </ReadValue>
              </FormField>
              <FormField
                field="taxRule.documentType"
                label={intake.documentType}
                layout="inline"
              >
                <ReadValue>
                  {intake.documentTypes[
                    rule.documentType as keyof typeof intake.documentTypes
                  ] ?? rule.documentType}
                </ReadValue>
              </FormField>
              <FormField
                field="taxRule.objectCode"
                label={t.objectCodeLabel}
                layout="inline"
              >
                <ReadValue mono>{rule.objectCode}</ReadValue>
              </FormField>
              <FormField
                field="taxRule.sourceCitation"
                label={t.citationLabel}
                layout="inline"
              >
                <ReadValue>{rule.sourceCitation}</ReadValue>
              </FormField>
            </FieldGroup>
            <FieldGroup title={t.rateLabel}>
              <FormField
                field="taxRule.rate"
                label={t.rateLabel}
                layout="inline"
              >
                <ReadValue mono>
                  {formatRationalRate(rule.rateNumerator, rule.rateDenominator)}{" "}
                  ({rule.rateNumerator}/{rule.rateDenominator})
                </ReadValue>
              </FormField>
              <FormField
                field="taxRule.roundingMode"
                label={t.roundingLabel}
                layout="inline"
              >
                <ReadValue>
                  {codeLabel(locale, "roundingMode", rule.roundingMode)}
                </ReadValue>
              </FormField>
              <FormField
                field="taxRule.effective"
                label={t.effectiveLabel}
                layout="inline"
              >
                <ReadValue mono>
                  {rule.effectiveFrom} → {rule.effectiveTo ?? "…"}
                </ReadValue>
              </FormField>
              <FormField
                field="taxRule.smeReviewedBy"
                label={t.smeReviewerLabel}
                layout="inline"
              >
                <ReadValue>{rule.smeReviewedBy}</ReadValue>
              </FormField>
            </FieldGroup>
          </div>
        </div>
      ) : (
        <FormBody
          model="tax-rules"
          onSubmit={() => void save()}
          disabled={saving}
        >
          {error && (
            <Notice tone="danger" role="alert">
              {error}
            </Notice>
          )}
          <Notice>{t.adminRulesIntro}</Notice>
          <div className="grid gap-x-12 gap-y-5 lg:grid-cols-2">
            <FieldGroup title={v.information}>
              <FormField
                field="taxRule.code"
                label={t.codeLabel}
                required
                layout="inline"
              >
                <TextInput
                  value={draft.code}
                  onChange={(e) => set({ code: e.target.value.toUpperCase() })}
                  maxLength={40}
                  className="font-mono uppercase"
                  autoFocus
                />
              </FormField>
              <FormField
                field="taxRule.version"
                label={t.versionLabel}
                required
                layout="inline"
              >
                <TextInput
                  type="number"
                  min={1}
                  max={1000}
                  value={draft.version}
                  onChange={(e) => set({ version: e.target.value })}
                  className="w-28"
                />
              </FormField>
              <FormField
                field="taxRule.name"
                label={t.nameLabel}
                required
                layout="inline"
              >
                <TextInput
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                  maxLength={150}
                />
              </FormField>
              <FormField
                field="taxRule.taxFamily"
                label={t.taxFamilyLabel}
                required
                layout="inline"
              >
                <Combobox
                  value={draft.taxFamily}
                  onChange={(value) => value && set({ taxFamily: value })}
                  options={allTaxFamilies.map((f) => ({ value: f, label: f }))}
                  labels={labels}
                />
              </FormField>
              <FormField
                field="taxRule.documentType"
                label={intake.documentType}
                required
                layout="inline"
              >
                <Combobox
                  value={draft.documentType}
                  onChange={(value) =>
                    value &&
                    set({ documentType: value as Draft["documentType"] })
                  }
                  options={documentTypes.map((d) => ({
                    value: d,
                    label: intake.documentTypes[d],
                  }))}
                  labels={labels}
                />
              </FormField>
              <FormField
                field="taxRule.objectCode"
                label={t.objectCodeLabel}
                required
                layout="inline"
              >
                <TextInput
                  value={draft.objectCode}
                  onChange={(e) =>
                    set({ objectCode: e.target.value.toUpperCase() })
                  }
                  maxLength={32}
                  className="font-mono uppercase"
                />
              </FormField>
            </FieldGroup>
            <FieldGroup title={t.rateLabel}>
              <FormField
                field="taxRule.rateNumerator"
                label={t.numeratorLabel}
                required
                layout="inline"
                help={`= ${rate}`}
              >
                <TextInput
                  type="number"
                  min={0}
                  value={draft.rateNumerator}
                  onChange={(e) => set({ rateNumerator: e.target.value })}
                  className="w-32"
                />
              </FormField>
              <FormField
                field="taxRule.rateDenominator"
                label={t.denominatorLabel}
                required
                layout="inline"
              >
                <TextInput
                  type="number"
                  min={1}
                  value={draft.rateDenominator}
                  onChange={(e) => set({ rateDenominator: e.target.value })}
                  className="w-32"
                />
              </FormField>
              <FormField
                field="taxRule.roundingMode"
                label={t.roundingLabel}
                layout="inline"
              >
                <Combobox
                  value={draft.roundingMode}
                  onChange={(value) =>
                    value && set({ roundingMode: value as TaxRoundingMode })
                  }
                  options={taxRoundingModes.map((m) => ({
                    value: m,
                    label: t.roundingModes[m],
                  }))}
                  labels={labels}
                />
              </FormField>
              <FormField
                field="taxRule.effectiveFrom"
                label={t.effectiveFromLabel}
                required
                layout="inline"
              >
                <TextInput
                  type="date"
                  value={draft.effectiveFrom}
                  onChange={(e) => set({ effectiveFrom: e.target.value })}
                />
              </FormField>
              <FormField
                field="taxRule.effectiveTo"
                label={t.effectiveToLabel}
                layout="inline"
              >
                <TextInput
                  type="date"
                  value={draft.effectiveTo}
                  onChange={(e) => set({ effectiveTo: e.target.value })}
                />
              </FormField>
            </FieldGroup>
          </div>
          <FieldGroup title={t.citationLabel} columns={2}>
            <FormField
              field="taxRule.sourceCitation"
              label={t.citationLabel}
              required
              layout="inline"
            >
              <TextInput
                value={draft.sourceCitation}
                onChange={(e) => set({ sourceCitation: e.target.value })}
                maxLength={300}
              />
            </FormField>
            <FormField
              field="taxRule.catalogStatus"
              label={intake.status}
              required
              layout="inline"
            >
              <Combobox
                value={draft.catalogStatus}
                onChange={(value) =>
                  value &&
                  set({ catalogStatus: value as Draft["catalogStatus"] })
                }
                options={(
                  ["DRAFT", "NON_PRODUCTION_TEST", "SME_APPROVED"] as const
                ).map((st) => ({ value: st, label: t.ruleStatuses[st] }))}
                labels={labels}
              />
            </FormField>
            {draft.catalogStatus === "SME_APPROVED" && (
              <FormField
                field="taxRule.smeReviewedBy"
                label={t.smeReviewerLabel}
                required
                layout="inline"
              >
                <TextInput
                  value={draft.smeReviewedBy}
                  onChange={(e) => set({ smeReviewedBy: e.target.value })}
                  maxLength={120}
                />
              </FormField>
            )}
          </FieldGroup>
          <div className="flex flex-col gap-2.5">
            <Checkbox
              label={t.requireIdentityLabel}
              checked={draft.reqIdentity}
              onChange={(e) => set({ reqIdentity: e.target.checked })}
            />
            <Checkbox
              label={t.requirePayrollLabel}
              checked={draft.reqPayroll}
              onChange={(e) => set({ reqPayroll: e.target.checked })}
            />
            <Checkbox
              label={t.requireTreatyLabel}
              checked={draft.reqTreaty}
              onChange={(e) => set({ reqTreaty: e.target.checked })}
            />
          </div>
        </FormBody>
      )}
      <Dialog
        open={approveDialog}
        onClose={() => setApproveDialog(false)}
        title={t.ruleStatuses.SME_APPROVED}
        size="sm"
        closeLabel={v.cancel}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setApproveDialog(false)}
            >
              {v.cancel}
            </Button>
            <Button
              type="button"
              disabled={reviewer.trim().length < 2}
              onClick={() => void changeStatus("SME_APPROVED", reviewer.trim())}
            >
              {v.confirm}
            </Button>
          </>
        }
      >
        <FormField
          field="taxRule.smeReviewedBy"
          label={t.smeReviewerLabel}
          required
        >
          <TextInput
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            maxLength={120}
            autoFocus
          />
        </FormField>
      </Dialog>
    </FormPage>
  );
}
