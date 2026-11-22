"use client";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

/** Legacy labelled input, styled with the shared field chrome. */
export function Field({
  label,
  className,
  ...props
}: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      <input className={`field-control ${className ?? ""}`} {...props} />
    </label>
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
