import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        gray: "bg-muted text-muted-foreground",
        blue: "bg-info-soft text-info-fg",
        green: "bg-success-soft text-success-fg",
        amber: "bg-warning-soft text-warning-fg",
        red: "bg-danger-soft text-danger-fg",
        violet: "bg-violet-soft text-violet-fg",
      },
    },
    defaultVariants: { tone: "gray" },
  },
);
export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({
  tone,
  className,
  dot = false,
  children,
}: VariantProps<typeof badgeVariants> & {
  className?: string;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={cn(badgeVariants({ tone }), className)}>
      {dot && (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
      )}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Backwards-compatible status pill (active = filled). */
export function StatusBadge({
  children,
  active = false,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <Badge tone={active ? "green" : "gray"} dot>
      {children}
    </Badge>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("skeleton rounded-md bg-muted", className)}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      aria-hidden="true"
      className={cn("size-4 animate-spin", className)}
    />
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  className,
  role,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  role?: "status" | "alert";
}) {
  const kind = tone;
  const Icon =
    kind === "success" ? CircleCheck : kind === "info" ? Info : TriangleAlert;
  return (
    <div
      role={role}
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3 text-sm",
        kind === "info" && "border-info/25 bg-info-soft",
        kind === "success" && "border-success/25 bg-success-soft",
        kind === "warning" && "border-warning/30 bg-warning-soft",
        kind === "danger" && "border-danger/30 bg-danger-soft",
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-4 shrink-0",
          kind === "info" && "text-info",
          kind === "success" && "text-success",
          kind === "warning" && "text-warning",
          kind === "danger" && "text-danger",
        )}
      />
      <div className="min-w-0 space-y-1 leading-6">
        {title && <p className="font-semibold text-foreground">{title}</p>}
        {children && <div className="text-foreground/80">{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className,
      )}
    >
      {icon && (
        <div className="flex size-14 items-center justify-center rounded-2xl border bg-surface-2 text-muted-foreground [&_svg]:size-6">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-base font-semibold">{title}</p>
        {hint && (
          <p className="max-w-md text-sm text-muted-foreground">{hint}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-xl border bg-surface shadow-xs", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
