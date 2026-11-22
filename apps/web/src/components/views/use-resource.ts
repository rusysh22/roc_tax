"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiFailure } from "@/components/intake/client";

/**
 * Loads workspace-scoped data with a uniform shape: data, failure code,
 * "no active workspace" detection and a reload function.
 */
export function useResource<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiFailure | Error | null>(null);
  const [noWorkspace, setNoWorkspace] = useState(false);
  const latest = useRef(loader);
  latest.current = loader;
  const generation = useRef(0);

  const reload = useCallback(async () => {
    const id = ++generation.current;
    try {
      const next = await latest.current();
      if (id !== generation.current) return;
      setData(next);
      setError(null);
      setNoWorkspace(false);
    } catch (failure) {
      if (id !== generation.current) return;
      if (failure instanceof ApiFailure && failure.code === "NO_WORKSPACE")
        setNoWorkspace(true);
      else setError(failure instanceof Error ? failure : new Error("FAILED"));
    }
  }, []);

  useEffect(() => {
    void reload();
    // Reload when the caller's dependencies change.
  }, deps);

  return { data, setData, error, noWorkspace, reload };
}
