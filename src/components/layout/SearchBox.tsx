import { useEffect, useRef, useState } from 'react';
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from '@headlessui/react';
import { selectSearch, useSelector, type SearchHit } from '@/store/selectors';
import { useUiStore } from '@/store/uiStore';
import { Kbd, StatusDot } from '@/components/ui/primitives';
import { Search } from '@/ui/icons';
import { cx } from '@/ui/tokens';

/** Stretch goal: client-side search over title + description of every task the viewer can see. */
export function SearchBox() {
  const [query, setQuery] = useState('');
  const hits = useSelector((s) => selectSearch(s, query), [query]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.closest('input, textarea, select, [contenteditable="true"]');
      if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onSelect = async (hit: SearchHit | null) => {
    if (!hit) return;
    setQuery('');
    inputRef.current?.blur();
    const ui = useUiStore.getState();
    await ui.selectList(hit.list.id);
    useUiStore.getState().openTask(hit.task.id);
  };

  return (
    <Combobox<SearchHit | null> value={null} onChange={onSelect} onClose={() => setQuery('')}>
      <div className="relative w-full max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
        <ComboboxInput
          ref={inputRef}
          aria-label="Search tasks"
          placeholder="Search tasks…"
          autoComplete="off"
          className="h-9 w-full rounded-lg border-0 bg-canvas pl-9 pr-10 text-sm text-ink ring-1 ring-inset ring-line placeholder:text-ink-subtle hover:ring-line-strong focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500"
          onChange={(e) => setQuery(e.target.value)}
          displayValue={() => query}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <Kbd>/</Kbd>
        </span>
      </div>
      {query.trim() && (
        <ComboboxOptions
          static
          anchor="bottom start"
          className="z-50 w-[var(--input-width)] min-w-80 rounded-card bg-surface p-1 shadow-pop ring-1 ring-black/5 empty:invisible focus:outline-none [--anchor-gap:6px]"
        >
          {hits.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-ink-muted">No tasks match “{query.trim()}” in lists you can see.</p>
          ) : (
            hits.map((hit) => (
              <ComboboxOption
                key={hit.task.id}
                value={hit}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 data-[focus]:bg-canvas"
              >
                {hit.status && <StatusDot status={hit.status} />}
                <span className="min-w-0 flex-1">
                  <span className={cx('block truncate text-sm text-ink', hit.status?.category === 'done' && 'text-ink-muted line-through')}>
                    {hit.task.title}
                  </span>
                  <span className="block truncate text-2xs text-ink-subtle">
                    {hit.list.name}
                    {hit.task.parentTaskId ? ' · subtask' : ''}
                  </span>
                </span>
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      )}
    </Combobox>
  );
}
