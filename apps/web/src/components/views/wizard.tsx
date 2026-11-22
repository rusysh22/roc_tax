"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { fmt, viewMessages } from "@/i18n/views";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type WizardStep = {
  id: string;
  title: string;
  content: ReactNode;
  /** Whether "Continue"/"Finish" is enabled on this step. */
  canContinue?: boolean;
  /** Runs before moving on; return false to stay on the step. */
  onContinue?: () => Promise<boolean | void> | boolean | void;
};

/** Odoo-style wizard: a modal with numbered steps and a fixed footer. */
export function Wizard({
  locale,
  open,
  onClose,
  title,
  description,
  steps,
  finishLabel,
  onFinish,
  busy = false,
  size = "lg",
}: {
  locale: Locale;
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  steps: WizardStep[];
  finishLabel?: string;
  onFinish: () => Promise<void> | void;
  busy?: boolean;
  size?: "md" | "lg" | "xl";
}) {
  const v = viewMessages[locale];
  const [index, setIndex] = useState(0);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;
  const disabled = busy || working || step?.canContinue === false;

  async function next() {
    if (!step) return;
    setWorking(true);
    try {
      const ok = await step.onContinue?.();
      if (ok === false) return;
      if (last) await onFinish();
      else setIndex((i) => i + 1);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      closeLabel={v.close}
      footer={
        <>
          <span className="mr-auto text-xs text-muted-foreground">
            {steps.length > 1 &&
              fmt(v.step, { n: index + 1, total: steps.length })}
          </span>
          <Button type="button" variant="outline" onClick={onClose}>
            {v.cancel}
          </Button>
          {index > 0 && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || working}
              onClick={() => setIndex((i) => i - 1)}
            >
              {v.back}
            </Button>
          )}
          <Button
            type="button"
            disabled={disabled}
            aria-busy={working || busy}
            onClick={() => void next()}
          >
            {last ? (finishLabel ?? v.finish) : v.continue}
          </Button>
        </>
      }
    >
      {steps.length > 1 && (
        <ol className="mb-6 flex items-center gap-2 text-xs font-medium">
          {steps.map((s, i) => (
            <li
              key={s.id}
              aria-current={i === index ? "step" : undefined}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.6875rem] font-semibold",
                  i < index &&
                    "border-foreground bg-foreground text-background",
                  i === index && "border-foreground",
                  i > index && "text-muted-foreground",
                )}
              >
                {i < index ? (
                  <Check aria-hidden="true" className="size-3.5" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={cn(
                  "hidden truncate sm:block",
                  i !== index && "text-muted-foreground",
                )}
              >
                {s.title}
              </span>
              {i < steps.length - 1 && (
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
              )}
            </li>
          ))}
        </ol>
      )}
      {step?.content}
    </Dialog>
  );
}
