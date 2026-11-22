"use client";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useFieldControl } from "./field";
import { Spinner } from "./status";
import { cn } from "@/lib/utils";

export type ComboOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type Labels = {
  placeholder: string;
  noOptions: string;
  clear: string;
  removeTag: (label: string) => string;
  moreTags?: (n: number) => string;
  searchMore?: string;
};

const defaultLabels: Labels = {
  placeholder: "Select…",
  noOptions: "No options",
  clear: "Clear",
  removeTag: (label) => `Remove ${label}`,
};

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function filterOptions(options: ComboOption[], query: string) {
  const q = normalize(query);
  if (!q) return options;
  return options.filter((option) =>
    normalize(`${option.label} ${option.description ?? ""}`).includes(q),
  );
}

/** Positions a fixed popover under (or above) its anchor; never clipped. */
function useAnchoredPosition(
  open: boolean,
  anchor: React.RefObject<HTMLElement | null>,
) {
  const [style, setStyle] = useState<React.CSSProperties>({});
  const update = useCallback(() => {
    const el = anchor.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const above = spaceBelow < 260 && rect.top > spaceBelow;
    setStyle({
      position: "fixed",
      left: Math.max(
        8,
        Math.min(rect.left, window.innerWidth - rect.width - 8),
      ),
      width: rect.width,
      ...(above
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
      maxHeight: Math.max(
        160,
        Math.min(320, above ? rect.top - 16 : spaceBelow - 16),
      ),
    });
  }, [anchor]);
  useLayoutEffect(() => {
    if (!open) return;
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);
  return style;
}

/** Debounced async option loading for server-side search. */
function useAsyncOptions(
  loadOptions: ((query: string) => Promise<ComboOption[]>) | undefined,
  query: string,
  open: boolean,
) {
  const [state, setState] = useState<{
    options: ComboOption[];
    loading: boolean;
  }>({ options: [], loading: false });
  useEffect(() => {
    if (!loadOptions || !open) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    const timer = window.setTimeout(() => {
      loadOptions(query)
        .then((options) => {
          if (!cancelled) setState({ options, loading: false });
        })
        .catch(() => {
          if (!cancelled) setState({ options: [], loading: false });
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadOptions, query, open]);
  return state;
}

function OptionList({
  id,
  options,
  activeIndex,
  selected,
  onPick,
  onHover,
  loading,
  noOptions,
  footer,
  style,
  anchor,
}: {
  anchor: React.RefObject<HTMLElement | null>;
  id: string;
  options: ComboOption[];
  activeIndex: number;
  selected: Set<string>;
  onPick: (option: ComboOption) => void;
  onHover: (index: number) => void;
  loading: boolean;
  noOptions: string;
  footer?: ReactNode;
  style: React.CSSProperties;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);
  return createPortal(
    <div
      style={style}
      className="animate-pop z-[70] flex flex-col overflow-hidden rounded-lg border bg-surface shadow-lg"
      onMouseDown={(event) => event.preventDefault()}
    >
      <ul
        ref={listRef}
        id={id}
        role="listbox"
        aria-multiselectable={selected.size > 1 || undefined}
        className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1"
      >
        {loading && options.length === 0 ? (
          <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <Spinner />
          </li>
        ) : options.length === 0 ? (
          <li className="px-3 py-2 text-sm text-muted-foreground">
            {noOptions}
          </li>
        ) : (
          options.map((option, index) => {
            const isSelected = selected.has(option.value);
            return (
              <li
                key={option.value}
                id={`${id}-${index}`}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                onMouseEnter={() => onHover(index)}
                onClick={() => !option.disabled && onPick(option)}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-md px-3 py-2 text-sm",
                  index === activeIndex && "bg-muted",
                  option.disabled && "cursor-not-allowed opacity-45",
                )}
              >
                <Check
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    !isSelected && "invisible",
                  )}
                />
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  {option.description && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </span>
              </li>
            );
          })
        )}
      </ul>
      {footer && (
        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          {footer}
        </div>
      )}
    </div>,
    // Inside a modal <dialog> (top layer) everything outside is inert, so the
    // list must render within the dialog to stay clickable.
    anchor.current?.closest("dialog") ?? document.body,
  );
}

function useListNavigation(
  options: ComboOption[],
  open: boolean,
  setOpen: (open: boolean) => void,
  onPick: (option: ComboOption) => void,
) {
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    setActiveIndex(0);
  }, [options.length, open]);
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return setOpen(true);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) =>
        options.length ? (i + delta + options.length) % options.length : 0,
      );
    } else if (event.key === "Enter") {
      if (open && options[activeIndex]) {
        event.preventDefault();
        if (!options[activeIndex].disabled) onPick(options[activeIndex]);
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }
  return { activeIndex, setActiveIndex, onKeyDown };
}

/**
 * Single-value searchable select (Odoo many2one / selection widget).
 * Always typeable, keyboard navigable, optionally async + clearable.
 */
export function Combobox({
  value,
  onChange,
  options = [],
  loadOptions,
  selectedLabel,
  labels,
  clearable = false,
  disabled = false,
  className,
  name,
  "aria-label": ariaLabel,
}: {
  value: string | null;
  onChange: (value: string | null, option: ComboOption | null) => void;
  options?: ComboOption[];
  loadOptions?: (query: string) => Promise<ComboOption[]>;
  /** Label for the current value when it is not in the loaded options. */
  selectedLabel?: string;
  labels?: Partial<Labels>;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
  name?: string;
  "aria-label"?: string;
}) {
  const l = { ...defaultLabels, ...labels };
  const field = useFieldControl();
  const fallbackId = useId();
  const inputId = field?.id ?? `cb${fallbackId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const listId = `${inputId}-list`;
  const anchor = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [typing, setTyping] = useState(false);
  const asyncState = useAsyncOptions(loadOptions, typing ? query : "", open);
  const pool = loadOptions ? asyncState.options : options;
  const visible = useMemo(
    () => (loadOptions ? pool : filterOptions(pool, typing ? query : "")),
    [loadOptions, pool, query, typing],
  );
  const current =
    options.find((o) => o.value === value) ??
    asyncState.options.find((o) => o.value === value) ??
    null;
  const currentLabel = current?.label ?? (value ? (selectedLabel ?? "") : "");
  const style = useAnchoredPosition(open, anchor);

  function pick(option: ComboOption) {
    onChange(option.value, option);
    setOpen(false);
    setTyping(false);
    setQuery("");
  }
  const nav = useListNavigation(visible, open, setOpen, pick);

  return (
    <div ref={anchor} className={cn("relative", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-describedby={field?.describedBy}
          aria-invalid={field?.invalid || undefined}
          aria-required={field?.required || undefined}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && visible[nav.activeIndex]
              ? `${listId}-${nav.activeIndex}`
              : undefined
          }
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          data-open={open}
          placeholder={l.placeholder}
          value={typing ? query : currentLabel}
          onChange={(event) => {
            setQuery(event.target.value);
            setTyping(true);
            setOpen(true);
          }}
          onFocus={(event) => event.target.select()}
          onClick={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setTyping(false);
            setQuery("");
          }}
          onKeyDown={nav.onKeyDown}
          className="field-control cursor-default pr-16 text-left"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2">
          {clearable && value && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              aria-label={l.clear}
              className="pointer-events-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(null, null);
                inputRef.current?.focus();
              }}
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          )}
          {typing ? (
            <Search
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
          ) : (
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          )}
        </div>
      </div>
      {open && (
        <OptionList
          id={listId}
          options={visible}
          activeIndex={nav.activeIndex}
          selected={new Set(value ? [value] : [])}
          onPick={pick}
          onHover={nav.setActiveIndex}
          loading={asyncState.loading}
          noOptions={l.noOptions}
          footer={loadOptions && !typing ? l.searchMore : undefined}
          style={style}
          anchor={anchor}
        />
      )}
    </div>
  );
}

/** Multi-value searchable select rendered as removable tags (many2many). */
export function MultiCombobox({
  values,
  onChange,
  options = [],
  loadOptions,
  labelsByValue = {},
  labels,
  disabled = false,
  className,
  maxVisibleTags = 6,
  "aria-label": ariaLabel,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options?: ComboOption[];
  loadOptions?: (query: string) => Promise<ComboOption[]>;
  labelsByValue?: Record<string, string>;
  labels?: Partial<Labels>;
  disabled?: boolean;
  className?: string;
  maxVisibleTags?: number;
  "aria-label"?: string;
}) {
  const l = { ...defaultLabels, ...labels };
  const field = useFieldControl();
  const fallbackId = useId();
  const inputId = field?.id ?? `mc${fallbackId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const listId = `${inputId}-list`;
  const anchor = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const asyncState = useAsyncOptions(loadOptions, query, open);
  const pool = loadOptions ? asyncState.options : options;
  const known = useRef(new Map<string, string>());
  for (const option of [...options, ...asyncState.options])
    known.current.set(option.value, option.label);
  const selected = new Set(values);
  const visible = useMemo(
    () => (loadOptions ? pool : filterOptions(pool, query)),
    [loadOptions, pool, query],
  );
  const style = useAnchoredPosition(open, anchor);
  const labelOf = (value: string) =>
    labelsByValue[value] ?? known.current.get(value) ?? value;

  function toggle(option: ComboOption) {
    onChange(
      selected.has(option.value)
        ? values.filter((v) => v !== option.value)
        : [...values, option.value],
    );
    setQuery("");
  }
  const nav = useListNavigation(visible, open, setOpen, toggle);
  const shown = showAll ? values : values.slice(0, maxVisibleTags);

  return (
    <div ref={anchor} className={cn("relative", className)}>
      <div
        data-open={open}
        aria-disabled={disabled || undefined}
        onClick={() => inputRef.current?.focus()}
        className="field-control flex min-h-10 cursor-text flex-wrap items-center gap-1.5 py-1.5"
      >
        {shown.map((value) => (
          <span
            key={value}
            className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted py-0.5 pr-1 pl-2 text-xs font-medium"
          >
            <span className="truncate">{labelOf(value)}</span>
            {!disabled && (
              <button
                type="button"
                aria-label={l.removeTag(labelOf(value))}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(values.filter((v) => v !== value));
                }}
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            )}
          </span>
        ))}
        {!showAll && values.length > maxVisibleTags && l.moreTags && (
          <button
            type="button"
            className="text-xs font-medium underline-offset-2 hover:underline"
            onClick={() => setShowAll(true)}
          >
            {l.moreTags(values.length - maxVisibleTags)}
          </button>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-describedby={field?.describedBy}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && visible[nav.activeIndex]
              ? `${listId}-${nav.activeIndex}`
              : undefined
          }
          autoComplete="off"
          disabled={disabled}
          placeholder={values.length ? "" : l.placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setQuery("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !query && values.length) {
              onChange(values.slice(0, -1));
              return;
            }
            nav.onKeyDown(event);
          }}
          className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-subtle-foreground focus-visible:outline-none"
        />
      </div>
      {open && (
        <OptionList
          id={listId}
          options={visible}
          activeIndex={nav.activeIndex}
          selected={selected}
          onPick={toggle}
          onHover={nav.setActiveIndex}
          loading={asyncState.loading}
          noOptions={l.noOptions}
          style={style}
          anchor={anchor}
        />
      )}
    </div>
  );
}
