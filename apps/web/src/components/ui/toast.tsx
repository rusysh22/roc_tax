"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = {
  id: number;
  message: ReactNode;
  tone: "success" | "info" | "error";
};
type ToastApi = {
  success: (message: ReactNode) => void;
  info: (message: ReactNode) => void;
  error: (message: ReactNode) => void;
};
const ToastContext = createContext<ToastApi | null>(null);

const noop: ToastApi = {
  success: () => undefined,
  info: () => undefined,
  error: () => undefined,
};

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? noop;
}

/** Odoo-style transient notifications (top-right, polite live region). */
export function ToastProvider({
  children,
  closeLabel = "Close",
}: {
  children: ReactNode;
  closeLabel?: string;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((t) => t.id !== id)),
    [],
  );
  const push = useCallback(
    (tone: Toast["tone"], message: ReactNode) => {
      const id = ++seq.current;
      setToasts((all) => [...all.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 8000 : 4000);
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push("success", m),
      info: (m) => push("info", m),
      error: (m) => push("error", m),
    }),
    [push],
  );
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed top-16 right-3 z-[80] flex w-[min(24rem,calc(100%-1.5rem))] flex-col gap-2"
      >
        {toasts.map((toast) => {
          const Icon =
            toast.tone === "success"
              ? CircleCheck
              : toast.tone === "error"
                ? TriangleAlert
                : Info;
          return (
            <div
              key={toast.id}
              role={toast.tone === "error" ? "alert" : "status"}
              className={cn(
                "animate-pop pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg",
                toast.tone === "error"
                  ? "border-foreground bg-foreground text-background"
                  : "bg-surface",
              )}
            >
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1 leading-5">{toast.message}</div>
              <button
                type="button"
                aria-label={closeLabel}
                onClick={() => dismiss(toast.id)}
                className="-m-1 rounded p-1 opacity-70 hover:opacity-100"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
