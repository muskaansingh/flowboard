import { useState } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { EMPTY_FILTER, useUiStore } from '@/store/uiStore';
import { toast } from '@/store/toastStore';
import { Bookmark, ChevronDown, Trash } from '@/ui/icons';
import { cx, focusRing } from '@/ui/tokens';

/** "Views ▾": apply a saved filter set for this list, or save the current one under a name. */
export function SavedViews({ canSave }: { canSave: boolean }) {
  const listId = useUiStore((s) => s.selectedListId);
  const all = useUiStore((s) => s.savedViews);
  const views = all.filter((v) => v.listId === listId);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  if (naming) {
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          const v = useUiStore.getState().saveView(name);
          if (v) toast.success('View saved', `“${v.name}” is in the Views menu.`);
          setNaming(false);
          setName('');
        }}
      >
        <input
          autoFocus
          aria-label="View name"
          placeholder="Name this view…"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setNaming(false);
              setName('');
            }
          }}
          onBlur={() => !name.trim() && setNaming(false)}
          className="h-8 w-40 rounded-lg border-0 bg-surface px-2.5 text-xs text-ink ring-1 ring-inset ring-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </form>
    );
  }

  return (
    <Menu>
      <MenuButton
        className={cx(
          'inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface px-3 text-xs font-medium text-ink-muted ring-1 ring-inset ring-line hover:text-ink hover:ring-line-strong data-[open]:ring-2 data-[open]:ring-brand-500',
          focusRing,
        )}
      >
        <Bookmark size={12} /> Views
        {views.length > 0 && <span className="tabular-nums text-ink-subtle">{views.length}</span>}
        <ChevronDown size={12} className="opacity-60" />
      </MenuButton>
      <MenuItems anchor="bottom start" className="z-50 w-60 rounded-card bg-surface p-1 shadow-pop ring-1 ring-black/5 focus:outline-none [--anchor-gap:4px]">
        {views.length === 0 && <p className="px-2.5 py-2 text-xs text-ink-subtle">No saved views for this list yet.</p>}
        {views.map((v) => (
          <div key={v.id} className="group flex items-center">
            <MenuItem>
              <button
                type="button"
                onClick={() => useUiStore.setState({ filter: { ...EMPTY_FILTER, ...v.filter } })}
                className="min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 text-left text-sm text-ink data-[focus]:bg-canvas"
              >
                {v.name}
              </button>
            </MenuItem>
            <button
              type="button"
              aria-label={`Delete view ${v.name}`}
              onClick={() => useUiStore.getState().deleteView(v.id)}
              className="mr-1 rounded p-1 text-ink-subtle opacity-0 hover:bg-rose-50 hover:text-rose-700 focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Trash size={12} />
            </button>
          </div>
        ))}
        <div className="mt-1 border-t border-line pt-1">
          <MenuItem disabled={!canSave}>
            <button
              type="button"
              onClick={() => setNaming(true)}
              className="w-full rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-brand-700 data-[disabled]:cursor-not-allowed data-[focus]:bg-canvas data-[disabled]:text-ink-subtle"
            >
              {canSave ? 'Save current filters…' : 'Set some filters to save a view'}
            </button>
          </MenuItem>
        </div>
      </MenuItems>
    </Menu>
  );
}
