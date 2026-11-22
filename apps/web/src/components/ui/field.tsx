"use client";
import {
  createContext,
  useContext,
  useId,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Check } from "lucide-react";
import { fieldInfo, type FieldKey } from "@/i18n/fields";
import { viewMessages } from "@/i18n/views";
import { cn } from "@/lib/utils";
import { useLocale } from "./locale-context";
import { InfoTip } from "./tooltip";

/**
 * Field context: a label, help text and error wired to one control by id, so
 * every input/combobox gets the same accessible labelling and layout.
 */
type FieldContextValue = {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
};
const FieldContext = createContext<FieldContextValue | null>(null);
export function useFieldControl() {
  return useContext(FieldContext);
}

export function FormField({
  field,
  label: explicitLabel,
  help,
  error,
  required = false,
  layout = "stacked",
  className,
  children,
  id: explicitId,
}: {
  /** Field dictionary key: supplies the label and the standard info tip. */
  field: FieldKey;
  label?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  layout?: "stacked" | "inline";
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  const locale = useLocale();
  const info = fieldInfo(locale, field);
  const label = explicitLabel ?? info.label;
  const v = viewMessages[locale];
  const generated = useId();
  const id = explicitId ?? `f${generated.replace(/[^a-zA-Z0-9]/g, "")}`;
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <FieldContext.Provider
      value={{ id, describedBy, invalid: Boolean(error), required }}
    >
      <div
        className={cn(
          layout === "inline"
            ? "grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(8rem,38%)_minmax(0,1fr)] sm:items-start"
            : "space-y-1.5",
          className,
        )}
      >
        <div
          className={cn(
            "flex items-start gap-1",
            layout === "inline" && "sm:pt-2",
          )}
        >
          <label
            id={`${id}-label`}
            htmlFor={id}
            className={cn(
              "text-sm font-medium text-foreground",
              layout === "inline" && "sm:text-muted-foreground",
            )}
          >
            {label}
          </label>
          {/* Outside the label so the accessible name stays exactly the label. */}
          {required && (
            <span
              aria-hidden="true"
              className="-ml-0.5 font-semibold text-danger"
            >
              *
            </span>
          )}
          <InfoTip
            functional={info.help}
            technical={info.technical}
            label={v.information}
            describedBy={`${id}-label`}
            technicalLabel={v.technicalName}
            className="mt-0.5"
          />
        </div>
        <div className="min-w-0 space-y-1">
          {children}
          {help && (
            <p id={helpId} className="text-xs leading-5 text-muted-foreground">
              {help}
            </p>
          )}
          {error && (
            <p
              id={errorId}
              className="text-xs leading-5 font-semibold text-foreground"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </FieldContext.Provider>
  );
}

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  const field = useFieldControl();
  return (
    <input
      id={field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      required={field?.required || undefined}
      className={cn("field-control", className)}
      {...props}
    />
  );
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  const field = useFieldControl();
  return (
    <textarea
      id={field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      required={field?.required || undefined}
      className={cn("field-control min-h-20 resize-y", className)}
      {...props}
    />
  );
}

/** Plain value shown in read mode (Odoo-style readonly widget). */
export function ReadValue({
  children,
  className,
  mono = false,
}: {
  children: ReactNode;
  className?: string;
  mono?: boolean;
}) {
  const field = useFieldControl();
  const empty =
    children === null ||
    children === undefined ||
    children === "" ||
    children === false;
  return (
    <div
      id={field?.id}
      aria-describedby={field?.describedBy}
      className={cn(
        "flex min-h-10 items-center py-2 text-sm break-words",
        mono && "font-mono",
        empty && "text-subtle-foreground",
        className,
      )}
    >
      {empty ? "—" : children}
    </div>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & {
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label
      className={cn(
        "group flex cursor-pointer items-start gap-3 text-sm has-disabled:cursor-not-allowed has-disabled:opacity-60",
        className,
      )}
    >
      <span className="relative mt-0.5 inline-flex size-4 shrink-0">
        <input
          type="checkbox"
          className="peer size-4 cursor-pointer appearance-none rounded border border-border-strong bg-surface transition-colors checked:border-foreground checked:bg-foreground disabled:cursor-not-allowed"
          {...props}
        />
        <Check
          aria-hidden="true"
          strokeWidth={3}
          className="pointer-events-none absolute inset-0 m-auto hidden size-3 text-background peer-checked:block"
        />
      </span>
      <span className="space-y-0.5">
        <span className="block leading-5">{label}</span>
        {description && (
          <span className="block text-xs leading-5 text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

/** Two-column Odoo-style field group inside a form sheet. */
export function FieldGroup({
  title,
  children,
  className,
  columns = 1,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  columns?: 1 | 2;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {title && (
        <h3 className="border-b pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </h3>
      )}
      <div
        className={cn(
          "grid gap-x-8 gap-y-3",
          columns === 2 && "lg:grid-cols-2",
        )}
      >
        {children}
      </div>
    </div>
  );
}
