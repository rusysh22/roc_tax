"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

/**
 * Modal built on the native <dialog>: focus trap, Esc and top-layer stacking
 * come from the browser. Used for wizards and confirmations.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeLabel = "Close",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeLabel?: string;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    const dialog = ref.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(event) => {
        if (dismissible && event.target === ref.current) onClose();
      }}
      className={cn(
        "animate-pop m-auto max-h-[min(90dvh,56rem)] w-[calc(100%-1.5rem)] overflow-hidden rounded-xl border bg-surface p-0 text-foreground shadow-lg backdrop:backdrop-blur-[1px] open:flex open:flex-col",
        size === "sm" && "max-w-md",
        size === "md" && "max-w-xl",
        size === "lg" && "max-w-3xl",
        size === "xl" && "max-w-5xl",
      )}
    >
      {open && (
        <>
          <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div className="min-w-0 space-y-1">
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {dismissible && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={closeLabel}
                onClick={onClose}
                className="-mt-1 -mr-2"
              >
                <X aria-hidden="true" />
              </Button>
            )}
          </header>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {children}
          </div>
          {footer && (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t bg-surface-2 px-5 py-3">
              {footer}
            </footer>
          )}
        </>
      )}
    </dialog>
  );
}

/** Confirmation dialog for destructive or irreversible actions. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      closeLabel={cancelLabel}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm leading-6 text-muted-foreground">
        {body && <p>{body}</p>}
        {children}
      </div>
    </Dialog>
  );
}
