"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Click-to-open popover anchored to its trigger (fixed position, flips and
 * clamps to the viewport). Closes on outside click, Esc and route changes.
 */
export function Popover({
  trigger,
  children,
  align = "start",
  width,
  role = "dialog",
  label,
  className,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger: (props: {
    open: boolean;
    toggle: () => void;
    ref: (el: HTMLButtonElement | null) => void;
    "aria-expanded": boolean;
    "aria-haspopup": "menu" | "dialog";
  }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "start" | "end";
  width?: number;
  role?: "menu" | "dialog";
  label?: string;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = useCallback(
    (next: boolean) => {
      setUncontrolled(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );
  const anchor = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const place = useCallback(() => {
    const el = anchor.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const panelWidth = Math.min(
      width ?? Math.max(rect.width, 220),
      window.innerWidth - 16,
    );
    let left = align === "end" ? rect.right - panelWidth : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < 240 && rect.top > spaceBelow;
    setStyle({
      position: "fixed",
      left,
      width: panelWidth,
      ...(above
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
      maxHeight: Math.max(180, (above ? rect.top : spaceBelow) - 16),
    });
  }, [align, width]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || anchor.current?.contains(target))
        return;
      // Clicks inside a nested portal (e.g. a combobox list) keep the panel open.
      if ((target as HTMLElement).closest?.("[role=listbox]")) return;
      setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        anchor.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  useEffect(() => {
    if (open && role === "menu")
      panel.current
        ?.querySelector<HTMLElement>("[role=menuitem]:not([disabled])")
        ?.focus();
  }, [open, role]);

  const close = () => setOpen(false);
  return (
    <>
      {trigger({
        open,
        toggle: () => setOpen(!open),
        ref: (el) => {
          anchor.current = el;
        },
        "aria-expanded": open,
        "aria-haspopup": role,
      })}
      {open &&
        createPortal(
          <div
            ref={panel}
            role={role}
            aria-label={label}
            style={style}
            onKeyDown={role === "menu" ? menuKeys : undefined}
            className={cn(
              "animate-pop scroll-thin z-[60] overflow-y-auto rounded-lg border bg-surface p-1 text-foreground shadow-lg",
              className,
            )}
          >
            {typeof children === "function" ? children(close) : children}
          </div>,
          document.body,
        )}
    </>
  );
}

function menuKeys(event: KeyboardEvent<HTMLDivElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      "[role=menuitem]:not([disabled]),[role=menuitemcheckbox]:not([disabled])",
    ),
  ];
  if (!items.length) return;
  const index = items.indexOf(document.activeElement as HTMLElement);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
          items.length;
  items[next].focus();
}

export function MenuItem({
  icon,
  children,
  onSelect,
  disabled = false,
  checked,
  hint,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  checked?: boolean;
  hint?: ReactNode;
  className?: string;
}) {
  const checkable = checked !== undefined;
  return (
    <button
      type="button"
      role={checkable ? "menuitemcheckbox" : "menuitem"}
      aria-checked={checkable ? checked : undefined}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors outline-none hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
    >
      {checkable ? (
        <Check
          aria-hidden="true"
          className={cn(!checked && "invisible")}
          strokeWidth={2.5}
        />
      ) : (
        icon
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {hint}
        </span>
      )}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pt-2 pb-1 text-[0.6875rem] font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </div>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}
