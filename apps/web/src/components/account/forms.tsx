"use client";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
export function Field({
  label,
  ...props
}: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      <input
        className="block min-h-11 w-full rounded-md border bg-background px-3 py-2 focus:outline-2 focus:outline-offset-2"
        {...props}
      />
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
    <Button type="submit" disabled={busy}>
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
