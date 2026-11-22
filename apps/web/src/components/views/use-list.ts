"use client";
import { useCallback, useEffect, useState } from "react";
import {
  decodeSearch,
  emptySearch,
  encodeSearch,
  type SearchState,
} from "./search";

/**
 * Search state persisted in the URL (`?s=`), so filters survive reloads,
 * back/forward navigation and the language switch.
 */
export function useSearchState(initial: SearchState = emptySearch) {
  const [state, setState] = useState<SearchState>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const decoded = decodeSearch(
      new URLSearchParams(window.location.search).get("s"),
    );
    if (decoded) setState(decoded);
    setReady(true);
    const onPop = () => {
      setState(
        decodeSearch(new URLSearchParams(window.location.search).get("s")) ??
          initial,
      );
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // `initial` is a stable default for the view.
  }, []);
  const update = useCallback((next: SearchState) => {
    setState(next);
    const url = new URL(window.location.href);
    const encoded = encodeSearch(next);
    if (encoded) url.searchParams.set("s", encoded);
    else url.searchParams.delete("s");
    window.history.replaceState(window.history.state, "", url);
  }, []);
  return [state, update, ready] as const;
}

export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const setAll = useCallback((ids: string[], on: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);
  const clear = useCallback(() => setSelected(new Set()), []);
  return { selected, toggle, setAll, clear, setSelected };
}

/** Ordered ids of the last visible list, used by the form record pager. */
export function rememberRecordOrder(model: string, ids: string[]) {
  try {
    sessionStorage.setItem(`serentax:order:${model}`, JSON.stringify(ids));
  } catch {
    /* Record pager simply hides when storage is unavailable. */
  }
}

export function recordNeighbours(model: string, id: string) {
  try {
    const ids = JSON.parse(
      sessionStorage.getItem(`serentax:order:${model}`) ?? "[]",
    ) as string[];
    const index = ids.indexOf(id);
    if (index < 0) return null;
    return {
      index: index + 1,
      total: ids.length,
      previous: ids[(index - 1 + ids.length) % ids.length],
      next: ids[(index + 1) % ids.length],
    };
  } catch {
    return null;
  }
}
