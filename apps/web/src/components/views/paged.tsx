"use client";
import { useState } from "react";
import type { ViewMessages } from "@/i18n/views";
import { LIST_PAGE_SIZE, Pager } from "./list-view";

/**
 * Client-side paging for inner tables and feeds (import rows, export items,
 * chatter, sessions…). Every list in the app is capped at LIST_PAGE_SIZE rows
 * per page so no screen scrolls without limit (14_UI_STANDARDS.md).
 */
export function usePaged<T>(items: readonly T[], size = LIST_PAGE_SIZE) {
  const [requested, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(requested, pages);
  const rows = items.slice((page - 1) * size, page * size);
  return { page, pages, rows, setPage, size, total: items.length };
}

/** Pager row shown under an inner table only when it has more than one page. */
export function PagedFooter({
  paged,
  v,
}: {
  paged: ReturnType<typeof usePaged<unknown>>;
  v: ViewMessages;
}) {
  if (paged.pages <= 1) return null;
  return (
    <div className="flex justify-end border-t px-3 py-2">
      <Pager
        page={paged.page}
        pageSize={paged.size}
        total={paged.total}
        onPage={paged.setPage}
        v={v}
      />
    </div>
  );
}
