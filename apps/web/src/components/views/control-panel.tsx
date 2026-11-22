"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1 text-lg font-semibold">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={index} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-subtle-foreground"
                />
              )}
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="truncate text-muted-foreground hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className="truncate"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Odoo-style control panel: left = primary buttons + breadcrumb (or the
 * selection bar), right = search and pager. Wraps cleanly on small screens.
 */
export function ControlPanel({
  left,
  title,
  search,
  right,
  className,
}: {
  left?: ReactNode;
  title: ReactNode;
  search?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 border-b bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/85 sm:px-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 basis-[18rem]">
          {left}
          <div className="min-w-0 flex-1">{title}</div>
        </div>
        {(search || right) && (
          <div
            className={cn(
              "flex min-w-0 items-center gap-3",
              search ? "flex-[2_1_28rem]" : "ml-auto flex-none",
            )}
          >
            {search && <div className="min-w-0 flex-1">{search}</div>}
            {right}
          </div>
        )}
      </div>
    </div>
  );
}

/** Header for non-list pages (dashboards, settings). */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
}) {
  return (
    <div className="border-b bg-surface px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          {breadcrumbs && breadcrumbs.length > 1 ? (
            <Breadcrumbs items={breadcrumbs} />
          ) : (
            <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
          )}
          {description && (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Standard padded content area under a control panel / page header. */
export function PageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[96rem] p-4 sm:p-6", className)}>
      {children}
    </div>
  );
}
