"use client";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarRange,
  ChevronDown,
  Filter,
  Layers,
  Search,
  X,
} from "lucide-react";
import { fmt, type ViewMessages } from "@/i18n/views";
import { Popover } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import {
  addTextFacet,
  dateRange,
  enumOptions,
  enumSelected,
  presetActive,
  setDateRange,
  toggleEnumValue,
  togglePreset,
  type Facet,
  type Preset,
  type SearchState,
  type ViewField,
} from "./search";

function facetText<R>(
  facet: Facet,
  fields: ViewField<R>[],
  presets: Preset<R>[],
  records: R[],
  v: ViewMessages,
) {
  if (facet.kind === "preset") {
    const labels = facet.ids.map(
      (id) => presets.find((p) => p.id === id)?.label ?? id,
    );
    return { label: v.filters, value: labels.join(" / ") };
  }
  const field = fields.find((f) => f.name === facet.field);
  const label = field?.label ?? facet.field;
  if (facet.kind === "date")
    return {
      label,
      value: `${facet.from ?? "…"} → ${facet.to ?? "…"}`,
    };
  if (facet.kind === "enum") {
    const options = field ? enumOptions(field, records) : [];
    return {
      label,
      value: facet.values
        .map((value) => options.find((o) => o.value === value)?.label ?? value)
        .join(" / "),
    };
  }
  return { label, value: facet.values.map((x) => `“${x}”`).join(" / ") };
}

export function SearchBar<R>({
  state,
  onChange,
  fields,
  presets = [],
  records = [],
  v,
  className,
}: {
  state: SearchState;
  onChange: (next: SearchState) => void;
  fields: ViewField<R>[];
  presets?: Preset<R>[];
  records?: R[];
  v: ViewMessages;
  className?: string;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const searchable = fields.filter((f) => f.searchable);
  const filterable = fields.filter((f) => f.filterable);
  const groupable = fields.filter((f) => f.groupable);
  const suggestions = text.trim() ? searchable : [];
  const showSuggestions = focused && suggestions.length > 0;

  function commit(index: number) {
    const field = suggestions[index];
    if (!field) return;
    onChange(addTextFacet(state, field.name, text));
    setText("");
    setActive(0);
  }

  function removeFacet(facet: Facet) {
    onChange({
      ...state,
      facets: state.facets.filter((f) => f !== facet),
      page: 1,
    });
  }

  const groupField = groupable.find((f) => f.name === state.groupBy);
  const rect = boxRef.current?.getBoundingClientRect();

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        ref={boxRef}
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex min-h-9 w-full cursor-text items-center gap-1.5 rounded-md border border-border-strong bg-surface py-1 pr-1 pl-2.5 shadow-xs transition-colors pointer-coarse:min-h-11",
          focused && "border-foreground ring-1 ring-foreground",
        )}
      >
        <Search
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {state.facets.map((facet, index) => {
            const { label, value } = facetText(
              facet,
              fields,
              presets,
              records,
              v,
            );
            const Icon =
              facet.kind === "date"
                ? CalendarRange
                : facet.kind === "text"
                  ? Search
                  : Filter;
            return (
              <span
                key={index}
                className="inline-flex max-w-full items-center overflow-hidden rounded-md border bg-muted text-xs"
              >
                <span className="flex items-center gap-1 bg-foreground px-1.5 py-1 text-background">
                  <Icon aria-hidden="true" className="size-3" />
                  <span className="sr-only">{label}</span>
                </span>
                <span className="truncate px-1.5 py-1">
                  <span className="text-muted-foreground">{label}: </span>
                  <span className="font-medium">{value}</span>
                </span>
                <button
                  type="button"
                  aria-label={fmt(v.removeFacet, {
                    label: `${label} ${value}`,
                  })}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeFacet(facet);
                  }}
                  className="px-1.5 py-1 text-muted-foreground hover:text-foreground"
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              </span>
            );
          })}
          {groupField && (
            <span className="inline-flex items-center overflow-hidden rounded-md border bg-muted text-xs">
              <span className="flex items-center bg-foreground px-1.5 py-1 text-background">
                <Layers aria-hidden="true" className="size-3" />
              </span>
              <span className="px-1.5 py-1">
                <span className="text-muted-foreground">{v.groupBy}: </span>
                <span className="font-medium">{groupField.label}</span>
              </span>
              <button
                type="button"
                aria-label={fmt(v.removeFacet, { label: groupField.label })}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange({ ...state, groupBy: null });
                }}
                className="px-1.5 py-1 text-muted-foreground hover:text-foreground"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </span>
          )}
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-label={v.search}
            aria-expanded={showSuggestions}
            aria-controls="search-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={
              showSuggestions ? `search-suggestion-${active}` : undefined
            }
            value={text}
            placeholder={state.facets.length || groupField ? "" : v.search}
            onChange={(event) => {
              setText(event.target.value);
              setActive(0);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit(active);
              } else if (event.key === "ArrowDown" && suggestions.length) {
                event.preventDefault();
                setActive((i) => (i + 1) % suggestions.length);
              } else if (event.key === "ArrowUp" && suggestions.length) {
                event.preventDefault();
                setActive(
                  (i) => (i - 1 + suggestions.length) % suggestions.length,
                );
              } else if (event.key === "Escape") {
                setText("");
              } else if (event.key === "Backspace" && !text) {
                if (groupField) onChange({ ...state, groupBy: null });
                else if (state.facets.length)
                  removeFacet(state.facets[state.facets.length - 1]);
              }
            }}
            className="min-w-32 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-subtle-foreground focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        {(filterable.length > 0 ||
          groupable.length > 0 ||
          presets.length > 0) && (
          <Popover
            align="end"
            width={filterable.length + groupable.length > 3 ? 560 : 300}
            label={v.filters}
            trigger={({ toggle, ref, ...aria }) => (
              <button
                ref={ref}
                type="button"
                {...aria}
                aria-label={v.filters}
                onClick={(event) => {
                  event.stopPropagation();
                  toggle();
                }}
                className="flex h-7 shrink-0 items-center gap-1 rounded px-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Filter aria-hidden="true" className="size-4" />
                <ChevronDown aria-hidden="true" className="size-3.5" />
              </button>
            )}
          >
            <FilterPanel
              state={state}
              onChange={onChange}
              filterable={filterable}
              groupable={groupable}
              presets={presets}
              records={records}
              v={v}
            />
          </Popover>
        )}
      </div>
      {showSuggestions &&
        rect &&
        createPortal(
          <ul
            id="search-suggestions"
            role="listbox"
            style={{
              position: "fixed",
              top: rect.bottom + 4,
              left: rect.left,
              width: rect.width,
            }}
            onMouseDown={(event) => event.preventDefault()}
            className="animate-pop z-[60] rounded-lg border bg-surface p-1 shadow-lg"
          >
            {suggestions.map((field, index) => (
              <li
                key={field.name}
                id={`search-suggestion-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => commit(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm",
                  index === active && "bg-muted",
                )}
              >
                <Search
                  aria-hidden="true"
                  className="size-3.5 text-muted-foreground"
                />
                <span className="text-muted-foreground">
                  {fmt(v.searchFor, { field: field.label })}
                </span>
                <span className="truncate font-semibold">{text}</span>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}

function FilterPanel<R>({
  state,
  onChange,
  filterable,
  groupable,
  presets,
  records,
  v,
}: {
  state: SearchState;
  onChange: (next: SearchState) => void;
  filterable: ViewField<R>[];
  groupable: ViewField<R>[];
  presets: Preset<R>[];
  records: R[];
  v: ViewMessages;
}) {
  const enumFields = filterable.filter((f) => f.type !== "date");
  const dateFields = filterable.filter((f) => f.type === "date");
  const counts = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const field of enumFields) {
      const inner = new Map<string, number>();
      for (const record of records) {
        const key = String(field.value(record) ?? "");
        inner.set(key, (inner.get(key) ?? 0) + 1);
      }
      map.set(field.name, inner);
    }
    return map;
  }, [enumFields, records]);
  return (
    <div className="grid gap-1 p-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] sm:divide-x">
      <div className="space-y-3 sm:pr-3">
        <p className="flex items-center gap-2 px-1 pt-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <Filter aria-hidden="true" className="size-3.5" />
          {v.filters}
        </p>
        {presets.length > 0 && (
          <div className="space-y-0.5">
            {presets.map((preset) => (
              <CheckRow
                key={preset.id}
                label={preset.label}
                checked={presetActive(state, preset.id)}
                onChange={() => onChange(togglePreset(state, preset))}
              />
            ))}
          </div>
        )}
        {enumFields.map((field) => {
          const selected = enumSelected(state, field.name);
          const options = enumOptions(field, records);
          if (!options.length) return null;
          return (
            <fieldset key={field.name} className="space-y-0.5">
              <legend className="px-1 pb-1 text-xs font-semibold">
                {field.label}
              </legend>
              <div className="scroll-thin max-h-44 overflow-y-auto">
                {options.map((option) => (
                  <CheckRow
                    key={option.value}
                    label={option.label}
                    hint={counts.get(field.name)?.get(option.value)}
                    checked={selected.includes(option.value)}
                    onChange={() =>
                      onChange(
                        toggleEnumValue(
                          state,
                          field.name,
                          option.value,
                          field.single,
                        ),
                      )
                    }
                  />
                ))}
              </div>
            </fieldset>
          );
        })}
        {dateFields.map((field) => {
          const range = dateRange(state, field.name);
          return (
            <fieldset key={field.name} className="space-y-1.5 px-1">
              <legend className="pb-1 text-xs font-semibold">
                {field.label}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>{v.from}</span>
                  <input
                    type="date"
                    value={range.from ?? ""}
                    onChange={(event) =>
                      onChange(
                        setDateRange(
                          state,
                          field.name,
                          event.target.value || undefined,
                          range.to,
                        ),
                      )
                    }
                    className="field-control min-h-9 py-1 text-xs"
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>{v.to}</span>
                  <input
                    type="date"
                    value={range.to ?? ""}
                    onChange={(event) =>
                      onChange(
                        setDateRange(
                          state,
                          field.name,
                          range.from,
                          event.target.value || undefined,
                        ),
                      )
                    }
                    className="field-control min-h-9 py-1 text-xs"
                  />
                </label>
              </div>
            </fieldset>
          );
        })}
      </div>
      {groupable.length > 0 && (
        <div className="space-y-1 pt-3 sm:pt-0 sm:pl-3">
          <p className="flex items-center gap-2 px-1 pt-1 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Layers aria-hidden="true" className="size-3.5" />
            {v.groupBy}
          </p>
          <CheckRow
            label={v.noGrouping}
            checked={!state.groupBy}
            radio
            onChange={() => onChange({ ...state, groupBy: null })}
          />
          {groupable.map((field) => (
            <CheckRow
              key={field.name}
              label={field.label}
              radio
              checked={state.groupBy === field.name}
              onChange={() =>
                onChange({ ...state, groupBy: field.name, page: 1 })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
  hint,
  radio = false,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  hint?: number;
  radio?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
      <input
        type={radio ? "radio" : "checkbox"}
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 cursor-pointer accent-foreground"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint !== undefined && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {hint}
        </span>
      )}
    </label>
  );
}
