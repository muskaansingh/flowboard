import type { ReactNode } from 'react';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { Check, ChevronDown, X } from '@/ui/icons';
import { cx, focusRing } from '@/ui/tokens';

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  count?: number;
}

/**
 * Jira-style quick-filter chip: "Status ▾" opens a multi-select with checkboxes.
 * When active it reads "Status: In progress" (or "Status · 2") and gets an inline clear (×).
 */
export function FilterDropdown<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FilterOption<T>[];
  value: T[];
  onChange: (v: T[]) => void;
}) {
  const active = value.length > 0;
  const summary = value.length === 1 ? options.find((o) => o.value === value[0])?.label : `${value.length}`;
  return (
    <Listbox value={value} onChange={onChange} multiple>
      <div className="relative inline-flex">
        <ListboxButton
          aria-label={`Filter by ${label.toLowerCase()}`}
          className={cx(
            'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium ring-1 ring-inset transition-colors data-[open]:ring-2 data-[open]:ring-brand-500',
            active ? 'bg-brand-50 pr-7 text-brand-700 ring-brand-300' : 'bg-surface text-ink-muted ring-line hover:text-ink hover:ring-line-strong',
            focusRing,
          )}
        >
          {label}
          {active ? (
            <span className="max-w-[8rem] truncate font-semibold">{value.length === 1 ? `: ${summary}` : ` · ${summary}`}</span>
          ) : (
            <ChevronDown size={12} className="opacity-60" />
          )}
        </ListboxButton>
        {active && (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()} filter`}
            onClick={() => onChange([])}
            className="absolute right-1 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-brand-700 hover:bg-brand-100"
          >
            <X size={11} />
          </button>
        )}
      </div>
      <ListboxOptions
        anchor="bottom start"
        className="z-50 max-h-72 min-w-52 overflow-y-auto rounded-card bg-surface p-1 shadow-pop ring-1 ring-black/5 focus:outline-none [--anchor-gap:4px]"
      >
        {options.map((o) => (
          <ListboxOption
            key={o.value}
            value={o.value}
            className="group flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-ink data-[focus]:bg-canvas"
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-line-strong text-white group-data-[selected]:border-brand-600 group-data-[selected]:bg-brand-600">
              <Check size={11} className="invisible group-data-[selected]:visible" />
            </span>
            {o.icon}
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {o.count !== undefined && <span className="text-2xs tabular-nums text-ink-subtle">{o.count}</span>}
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}
