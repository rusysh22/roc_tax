"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Pencil,
  RotateCcw,
  Settings,
} from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { formatDate } from "@/i18n/format";
import { fmt, viewMessages } from "@/i18n/views";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Popover } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/status";
import { cn } from "@/lib/utils";
import { Breadcrumbs, ControlPanel, type Crumb } from "./control-panel";
import { PagedFooter, usePaged } from "./paged";
import { recordNeighbours } from "./use-list";

export type FormMode = "read" | "edit" | "create";

/** Warns before leaving the page with unsaved changes. */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

function RecordPager({
  locale,
  model,
  recordId,
  hrefFor,
}: {
  locale: Locale;
  model: string;
  recordId: string;
  hrefFor: (id: string) => string;
}) {
  const v = viewMessages[locale];
  const [info, setInfo] = useState<ReturnType<typeof recordNeighbours>>(null);
  useEffect(() => {
    setInfo(recordNeighbours(model, recordId));
  }, [model, recordId]);
  if (!info || info.total < 2) return null;
  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="px-1 text-muted-foreground tabular-nums">
        {fmt(v.recordPager, { index: info.index, total: info.total })}
      </span>
      <Link
        href={hrefFor(info.previous)}
        aria-label={v.previousRecord}
        className="inline-flex size-8 items-center justify-center rounded-md border border-border-strong bg-surface hover:bg-surface-2"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </Link>
      <Link
        href={hrefFor(info.next)}
        aria-label={v.nextRecord}
        className="inline-flex size-8 items-center justify-center rounded-md border border-border-strong bg-surface hover:bg-surface-2"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}

export type StatusStep = { id: string; label: string };

/** Odoo statusbar: workflow buttons on the left, pipeline on the right. */
export function StatusBar({
  steps,
  current,
  buttons,
  label,
}: {
  steps: StatusStep[];
  current: string;
  buttons?: ReactNode;
  label?: string;
}) {
  const index = steps.findIndex((s) => s.id === current);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">{buttons}</div>
      {steps.length > 0 && (
        <ol
          aria-label={label}
          className="scroll-thin flex max-w-full items-center overflow-x-auto text-xs font-medium"
        >
          {steps.map((step, i) => {
            const isCurrent = i === index;
            const done = index >= 0 && i < index;
            return (
              <li
                key={step.id}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "relative flex h-8 shrink-0 items-center gap-1.5 border-y border-r pr-3 pl-5 first:rounded-l-md first:border-l first:pl-3 last:rounded-r-md",
                  isCurrent
                    ? "border-foreground bg-foreground text-background"
                    : done
                      ? "bg-muted text-foreground"
                      : "bg-surface text-muted-foreground",
                  // Hide all but neighbours of the current step on phones.
                  Math.abs(i - index) > 1 && "hidden sm:flex",
                )}
              >
                {done && <Check aria-hidden="true" className="size-3" />}
                {step.label}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function FormPage({
  locale,
  breadcrumbs,
  model,
  recordId,
  hrefFor,
  mode,
  dirty = false,
  saving = false,
  canEdit = false,
  onEdit,
  onDiscard,
  gear,
  statusBar,
  ribbon,
  banner,
  chatter,
  loading = false,
  children,
}: {
  locale: Locale;
  breadcrumbs: Crumb[];
  model: string;
  recordId?: string;
  hrefFor?: (id: string) => string;
  mode: FormMode;
  dirty?: boolean;
  saving?: boolean;
  canEdit?: boolean;
  onEdit?: () => void;
  onDiscard?: () => void;
  gear?: (close: () => void) => ReactNode;
  statusBar?: ReactNode;
  ribbon?: string;
  banner?: ReactNode;
  chatter?: ReactNode;
  loading?: boolean;
  children: ReactNode;
}) {
  const v = viewMessages[locale];
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  useUnsavedGuard(mode !== "read" && dirty);
  const editing = mode !== "read";

  const actions = editing ? (
    <div className="flex items-center gap-2">
      <Button
        type="submit"
        form={`${model}-form`}
        disabled={saving}
        aria-busy={saving}
      >
        <Check aria-hidden="true" />
        <span>{saving ? v.saving : v.save}</span>
      </Button>
      {onDiscard && (
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => (dirty ? setConfirmDiscard(true) : onDiscard())}
        >
          <RotateCcw aria-hidden="true" />
          <span>{v.discard}</span>
        </Button>
      )}
    </div>
  ) : canEdit && onEdit ? (
    <Button type="button" onClick={onEdit}>
      <Pencil aria-hidden="true" />
      <span>{v.edit}</span>
    </Button>
  ) : null;

  return (
    <div className="flex min-h-full flex-col">
      <ControlPanel
        left={actions}
        title={
          <div className="flex min-w-0 items-center gap-1.5">
            <Breadcrumbs items={breadcrumbs} />
            {gear && mode !== "create" && (
              <Popover
                role="menu"
                label={v.actions}
                trigger={({ toggle, ref, ...aria }) => (
                  <Button
                    ref={ref}
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={v.actions}
                    onClick={toggle}
                    {...aria}
                  >
                    <Settings aria-hidden="true" />
                  </Button>
                )}
              >
                {(close) => gear(close)}
              </Popover>
            )}
          </div>
        }
        right={
          recordId && hrefFor && mode === "read" ? (
            <div className="ml-auto">
              <RecordPager
                locale={locale}
                model={model}
                recordId={recordId}
                hrefFor={hrefFor}
              />
            </div>
          ) : undefined
        }
      />
      <div
        className={cn(
          "mx-auto grid w-full max-w-[96rem] flex-1 gap-6 p-0 sm:p-6",
          chatter && "2xl:grid-cols-[minmax(0,1fr)_26rem]",
        )}
      >
        <div className="min-w-0 space-y-4">
          {banner && <div className="px-4 pt-4 sm:p-0">{banner}</div>}
          <div className="relative overflow-hidden border-y bg-surface sm:rounded-xl sm:border sm:shadow-xs">
            {ribbon && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-0 right-0 z-10 size-28 overflow-hidden"
              >
                <div className="absolute top-6 -right-9 w-40 rotate-45 bg-foreground py-1 text-center text-[0.6875rem] font-semibold tracking-wider text-background uppercase shadow-md">
                  {ribbon}
                </div>
              </div>
            )}
            {ribbon && <p className="sr-only">{ribbon}</p>}
            {statusBar}
            <div className="px-4 py-5 sm:px-8 sm:py-7">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-9 w-1/2" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                children
              )}
            </div>
          </div>
        </div>
        {chatter && <aside className="min-w-0">{chatter}</aside>}
      </div>
      <ConfirmDialog
        open={confirmDiscard}
        title={v.unsavedTitle}
        body={v.unsavedBody}
        confirmLabel={v.discard}
        cancelLabel={v.cancel}
        onConfirm={() => {
          setConfirmDiscard(false);
          onDiscard?.();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}

/** Form element wiring the control-panel Save button (form attribute). */
export function FormBody({
  model,
  onSubmit,
  disabled,
  children,
  className,
}: {
  model: string;
  onSubmit: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      id={`${model}-form`}
      noValidate={false}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit();
      }}
      className={className}
    >
      <fieldset disabled={disabled} className="min-w-0 space-y-6">
        {children}
      </fieldset>
    </form>
  );
}

/** Big record title area at the top of a sheet. */
export function SheetTitle({
  label,
  children,
  aside,
}: {
  label?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pr-16">
      <div className="min-w-0 flex-1 space-y-1">
        {label && (
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
        )}
        <h1 className="text-2xl font-semibold break-words sm:text-[1.75rem]">
          {children}
        </h1>
      </div>
      {aside && <div className="flex flex-wrap gap-2">{aside}</div>}
    </div>
  );
}

export type ChatterEntry = {
  id: string;
  author: string;
  at: string;
  body?: ReactNode;
  action?: string;
};

/** Comments + audit log panel (Odoo chatter). */
export function Chatter({
  locale,
  comments,
  log,
  canComment,
  onComment,
  busy = false,
  commentLabel,
  emptyComments,
}: {
  locale: Locale;
  comments: ChatterEntry[];
  log: ChatterEntry[];
  canComment: boolean;
  onComment?: (body: string) => Promise<void>;
  busy?: boolean;
  commentLabel: string;
  emptyComments?: string;
}) {
  const v = viewMessages[locale];
  const [tab, setTab] = useState<"messages" | "log">("messages");
  const [body, setBody] = useState("");
  const items = tab === "messages" ? comments : log;
  const paged = usePaged(items);
  return (
    <section
      aria-label={v.chatter}
      className="border-y bg-surface sm:rounded-xl sm:border sm:shadow-xs"
    >
      <div role="tablist" className="flex gap-1 border-b px-3 pt-2">
        {(["messages", "log"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium",
              tab === id
                ? "border-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {id === "messages" ? v.messages : v.log}
            <span className="rounded-full bg-muted px-1.5 text-[0.6875rem] tabular-nums">
              {id === "messages" ? comments.length : log.length}
            </span>
          </button>
        ))}
      </div>
      <div className="space-y-4 p-4">
        {tab === "messages" && canComment && onComment && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!body.trim()) return;
              await onComment(body.trim());
              setBody("");
            }}
            className="space-y-2"
          >
            <label className="sr-only" htmlFor="chatter-body">
              {commentLabel}
            </label>
            <textarea
              id="chatter-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={commentLabel}
              maxLength={2000}
              rows={2}
              className="field-control resize-y"
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={busy || !body.trim()}>
                <MessageSquare aria-hidden="true" />
                <span>{v.sendComment}</span>
              </Button>
            </div>
          </form>
        )}
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {tab === "messages" && emptyComments ? emptyComments : v.none}
          </p>
        ) : (
          <ol className="space-y-4">
            {paged.rows.map((item) => (
              <li key={item.id} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase"
                >
                  {item.author.trim().slice(0, 2) || "?"}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm">
                    <span className="font-semibold">{item.author}</span>{" "}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(new Date(item.at), locale)}
                    </span>
                  </p>
                  {item.action && (
                    <p className="font-mono text-xs text-muted-foreground">
                      {item.action}
                    </p>
                  )}
                  {item.body && (
                    <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm break-words">
                      {item.body}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
        <PagedFooter paged={paged} v={v} />
      </div>
    </section>
  );
}
