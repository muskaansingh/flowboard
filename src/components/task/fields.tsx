import { useEffect, useState, type SyntheticEvent } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import type { ID, Status } from '@/domain/types';
import { normalizeLabel } from '@/domain/validation';
import { LabelChip, StatusDot, StatusPill } from '@/components/ui/primitives';
import { Check, ChevronDown } from '@/ui/icons';
import { CATEGORY_BUTTON, cx, focusRing } from '@/ui/tokens';

/** Jira's big status button: solid colour by category, opens the list's statuses. */
export function StatusButton({ statuses, value, onChange }: { statuses: Status[]; value: ID; onChange: (id: ID) => void }) {
  const current = statuses.find((s) => s.id === value);
  return (
    <Menu>
      <MenuButton
        aria-label={`Status: ${current?.name ?? 'none'}. Change status`}
        className={cx(
          'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold uppercase tracking-wide transition-colors',
          CATEGORY_BUTTON[current?.category ?? 'todo'],
          focusRing,
        )}
      >
        {current?.name ?? 'Status'}
        <ChevronDown size={13} />
      </MenuButton>
      <MenuItems
        anchor="bottom start"
        className="z-[70] min-w-48 rounded-card bg-surface p-1 shadow-pop ring-1 ring-black/5 focus:outline-none [--anchor-gap:4px]"
      >
        {statuses.map((s) => (
          <MenuItem key={s.id}>
            <button
              type="button"
              onClick={() => s.id !== value && onChange(s.id)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-ink data-[focus]:bg-canvas"
            >
              <StatusDot status={s} />
              <span className="flex-1">{s.name}</span>
              {s.id === value && <Check size={14} className="text-brand-600" />}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

/** Ghost text input that commits on blur/Enter and reverts on Esc. Used for story points. */
export function PointsInput({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  useEffect(() => setDraft(value === null ? '' : String(value)), [value]);
  const commit = () => {
    const next = draft.trim() === '' ? null : Number(draft);
    if (next !== value) onCommit(next);
  };
  return (
    <input
      aria-label="Story points"
      inputMode="decimal"
      placeholder="None"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setDraft(value === null ? '' : String(value));
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
      className="h-8 w-full rounded-lg border-0 bg-transparent px-2.5 text-xs text-ink placeholder:text-ink-subtle hover:bg-canvas focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500"
    />
  );
}

/** Chips + inline input. Enter/comma adds, Backspace on empty removes the last, suggestions from the list. */
export function LabelPicker({ value, suggestions, onChange }: { value: string[]; suggestions: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const label = normalizeLabel(raw);
    if (label && !value.includes(label)) onChange([...value, label]);
    setDraft('');
  };
  const q = normalizeLabel(draft);
  const matches = q ? suggestions.filter((s) => s.includes(q) && !value.includes(s)).slice(0, 5) : [];
  return (
    <div className="relative">
      <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-lg px-2 py-1 focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand-500 hover:bg-canvas">
        {value.map((l) => (
          <LabelChip key={l} label={l} onRemove={() => onChange(value.filter((x) => x !== l))} />
        ))}
        <input
          aria-label="Add label"
          value={draft}
          placeholder={value.length ? '' : 'None'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && draft.trim()) {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1));
            } else if (e.key === 'Escape' && draft) {
              e.preventDefault();
              e.stopPropagation();
              setDraft('');
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          className="h-6 min-w-[4rem] flex-1 border-0 bg-transparent p-0 text-xs text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-0"
        />
      </div>
      {matches.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-[70] mt-1 rounded-card bg-surface p-1 shadow-pop ring-1 ring-black/5">
          {matches.map((m) => (
            <li key={m}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(m)}
                className="w-full rounded-md px-2.5 py-1 text-left text-xs text-ink hover:bg-canvas"
              >
                {m}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const stop = (e: SyntheticEvent) => e.stopPropagation();

/** Status pill that opens a status menu in place — for table rows (doesn't open the row). */
export function InlineStatusMenu({ statuses, value, onChange }: { statuses: Status[]; value: ID; onChange: (id: ID) => void }) {
  const current = statuses.find((s) => s.id === value);
  return (
    <Menu>
      <span className="contents" onClick={stop} onKeyDown={stop} onPointerDown={stop}>
        <MenuButton
          aria-label={`Status: ${current?.name ?? 'none'}. Change status`}
          className="rounded-pill transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 data-[open]:ring-2 data-[open]:ring-brand-400"
        >
          {current ? <StatusPill status={current} /> : '—'}
        </MenuButton>
        <MenuItems anchor="bottom start" className="z-50 min-w-44 rounded-card bg-surface p-1 shadow-pop ring-1 ring-black/5 focus:outline-none [--anchor-gap:4px]">
          {statuses.map((s) => (
            <MenuItem key={s.id}>
              <button
                type="button"
                onClick={() => s.id !== value && onChange(s.id)}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-ink data-[focus]:bg-canvas"
              >
                <StatusDot status={s} />
                <span className="flex-1">{s.name}</span>
                {s.id === value && <Check size={14} className="text-brand-600" />}
              </button>
            </MenuItem>
          ))}
        </MenuItems>
      </span>
    </Menu>
  );
}
