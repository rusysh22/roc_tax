"use client";
import {
  cloneElement,
  isValidElement,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible tooltip: shows on hover and keyboard focus, hides on Esc/blur,
 * and is referenced by aria-describedby. Rendered in a portal (inside an
 * open <dialog> when needed) so it is never clipped.
 */
export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: ReactNode;
  children: ReactElement<Record<string, unknown>>;
  side?: "top" | "bottom";
}) {
  const id = useId();
  const anchor = useRef<HTMLElement | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const show = () =>
    anchor.current && setRect(anchor.current.getBoundingClientRect());
  const hide = () => setRect(null);
  if (!isValidElement(children)) return children;
  const trigger = cloneElement(children, {
    ref: (el: HTMLElement | null) => {
      anchor.current = el;
    },
    "aria-describedby": rect
      ? id
      : (children.props["aria-describedby"] as string | undefined),
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    },
  });
  const above = side === "top" && rect && rect.top > 120;
  const container =
    (anchor.current?.closest("dialog") as HTMLElement | null) ??
    (typeof document !== "undefined" ? document.body : null);
  return (
    <>
      {trigger}
      {rect &&
        container &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            style={{
              position: "fixed",
              left: Math.max(
                8,
                Math.min(
                  rect.left + rect.width / 2 - 140,
                  window.innerWidth - 288,
                ),
              ),
              ...(above
                ? { bottom: window.innerHeight - rect.top + 8 }
                : { top: rect.bottom + 8 }),
            }}
            className="animate-pop pointer-events-none z-[90] w-[280px] rounded-lg bg-foreground px-3 py-2 text-xs leading-5 text-background shadow-lg"
          >
            {content}
          </div>,
          container,
        )}
    </>
  );
}

/**
 * Standard field/status help: functional meaning first, technical name second.
 * Every field label and status badge uses this (see 14_UI_STANDARDS.md).
 */
export function InfoTip({
  functional,
  technical,
  label = "Info",
  technicalLabel = "Nama teknis",
  className,
  describedBy,
}: {
  functional: ReactNode;
  technical?: string;
  label?: string;
  technicalLabel?: string;
  className?: string;
  /** Id of the element this tip explains (e.g. the field label). */
  describedBy?: string;
}) {
  return (
    <Tooltip
      content={
        <span className="block space-y-1.5">
          <span className="block">{functional}</span>
          {technical && (
            <span className="block border-t border-background/20 pt-1.5 text-background/70">
              {technicalLabel}:{" "}
              <code className="font-mono text-background">{technical}</code>
            </span>
          )}
        </span>
      }
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={describedBy}
        onClick={(event) => event.preventDefault()}
        className={cn(
          "inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full align-middle text-subtle-foreground transition-colors hover:text-primary focus-visible:text-primary",
          className,
        )}
      >
        <Info aria-hidden="true" className="size-3.5" />
      </button>
    </Tooltip>
  );
}
