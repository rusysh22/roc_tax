"use client";
import type { ComponentProps } from "react";
import type { FieldKey } from "@/i18n/fields";
import { Button } from "@/components/ui/button";
import { FormField, TextInput } from "@/components/ui/field";

/** Shorthand text field: standard FormField (label + info tip) + input. */
export function Field({
  field,
  label,
  className,
  required,
  ...props
}: ComponentProps<"input"> & { field: FieldKey; label?: string }) {
  return (
    <FormField field={field} label={label} required={required}>
      <TextInput className={className} {...props} />
    </FormField>
  );
}
export function Submit({
  busy,
  children,
}: {
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button type="submit" disabled={busy} aria-busy={busy}>
      {children}
    </Button>
  );
}
export async function post(path: string, body: unknown = {}) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      value.code ?? (response.status === 429 ? "RATE_LIMITED" : "FAILED"),
    );
  return value;
}
