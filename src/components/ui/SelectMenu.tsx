import type { ReactNode } from 'react';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { Check, ChevronDown } from '@/ui/icons';
import { cx, focusRing } from '@/ui/tokens';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  hint?: string;
}

/** Tailwind-styled Headless UI listbox for single or multi selection. */
export function SelectMenu<T extends string>({
  label,
  value,
  options,
  onChange,
  multiple,
  placeholder = 'Select…',
  renderValue,
  disabled,
}: {
  label: string;
  options: SelectOption<T>[];
  placeholder?: string;
  renderValue?: (selected: SelectOption<T>[]) => ReactNode;
  disabled?: boolean;
} & ({ multiple: true; value: T[]; onChange: (v: T[]) => void } | { multiple?: false; value: T; onChange: (v: T) => void })) {
  const selected = options.filter((o) => (multiple ? (value as T[]).includes(o.value) : o.value === value));
  return (
    <Listbox value={value} onChange={onChange as (v: T | T[]) => void} multiple={multiple} disabled={disabled}>
      <ListboxButton
        aria-label={label}
        className={cx(
          'flex min-h-[2.25rem] w-full items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-left text-sm text-ink ring-1 ring-inset ring-line-strong transition-colors hover:bg-canvas data-[open]:ring-2 data-[open]:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60',
          focusRing,
        )}
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {selected.length === 0 ? (
            <span className="text-ink-subtle">{placeholder}</span>
          ) : renderValue ? (
            renderValue(selected)
          ) : (
            selected.map((o) => (
              <span key={o.value} className="inline-flex items-center gap-1.5">
                {o.icon}
                <span className="truncate">{o.label}</span>
              </span>
            ))
          )}
        </span>
        <ChevronDown size={14} className="shrink-0 text-ink-subtle" />
      </ListboxButton>
      <ListboxOptions
        anchor="bottom start"
        className="z-[70] max-h-64 w-[var(--button-width)] overflow-y-auto rounded-card bg-surface p-1 shadow-pop ring-1 ring-black/5 focus:outline-none [--anchor-gap:4px]"
      >
        {options.map((o) => (
          <ListboxOption
            key={o.value}
            value={o.value}
            className="group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-ink data-[focus]:bg-canvas data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
          >
            {o.icon}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{o.label}</span>
              {o.hint && <span className="block truncate text-2xs text-ink-subtle">{o.hint}</span>}
            </span>
            <Check size={14} className="invisible text-brand-600 group-data-[selected]:visible" />
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}
