"use client";
import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TabItem = {
  id: string;
  label: ReactNode;
  badge?: ReactNode;
  content: ReactNode;
  hidden?: boolean;
};

/** Accessible tab list (Odoo "notebook") with roving arrow-key focus. */
export function Tabs({
  items,
  defaultTab,
  className,
  label,
}: {
  items: TabItem[];
  defaultTab?: string;
  className?: string;
  label?: string;
}) {
  const visible = items.filter((item) => !item.hidden);
  const [active, setActive] = useState(defaultTab ?? visible[0]?.id);
  const current = visible.find((item) => item.id === active) ?? visible[0];
  const base = useId().replace(/[^a-zA-Z0-9]/g, "");
  const listRef = useRef<HTMLDivElement>(null);
  if (!current) return null;
  return (
    <div className={cn("min-w-0", className)}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        className="scroll-thin -mx-1 flex gap-1 overflow-x-auto border-b px-1"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const index = visible.findIndex((item) => item.id === current.id);
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? visible.length - 1
                : (index +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    visible.length) %
                  visible.length;
          setActive(visible[next].id);
          listRef.current
            ?.querySelector<HTMLElement>(`#${base}-tab-${visible[next].id}`)
            ?.focus();
        }}
      >
        {visible.map((item) => {
          const selected = item.id === current.id;
          return (
            <button
              key={item.id}
              id={`${base}-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${base}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(item.id)}
              className={cn(
                "relative -mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                selected
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
              {item.badge !== undefined && item.badge !== null && (
                <span className="rounded-full bg-muted px-1.5 text-[0.6875rem] font-semibold tabular-nums">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        id={`${base}-panel-${current.id}`}
        role="tabpanel"
        aria-labelledby={`${base}-tab-${current.id}`}
        tabIndex={0}
        className="pt-5 focus-visible:outline-none"
      >
        {current.content}
      </div>
    </div>
  );
}
