import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions, Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import { useAppStore } from '@/store/appStore';
import { useUiStore } from '@/store/uiStore';
import { selectSearch, useSelector } from '@/store/selectors';
import { visibleListIds } from '@/domain/tree';
import { listPrefix } from '@/domain/taskKey';
import { Kbd, StatusDot, TaskTypeIcon } from '@/components/ui/primitives';
import { Board, ListIcon, PanelLeft, Plus, Rows, Search } from '@/ui/icons';
import { cx } from '@/ui/tokens';

interface Item {
  id: string;
  group: 'Actions' | 'Lists' | 'Tasks';
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

/** ⌘K / Ctrl+K: jump to any list or task, or run a common action, from anywhere. */
export function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const [query, setQuery] = useState('');
  const hits = useSelector((s) => selectSearch(s, query, 8), [query]);
  const state = useAppStore();
  const selectedListId = useUiStore((s) => s.selectedListId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!useUiStore.getState().paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const ui = useUiStore.getState();
    const q = query.trim().toLowerCase();
    const match = (s: string) => !q || s.toLowerCase().includes(q);
    const actions: Item[] = [
      ...(selectedListId
        ? [
            { id: 'a:new', group: 'Actions' as const, label: 'Create task', hint: 'N', icon: <Plus size={15} />, run: () => ui.setNewTaskOpen(true) },
            { id: 'a:board', group: 'Actions' as const, label: 'Switch to Board view', hint: 'B', icon: <Board size={15} />, run: () => ui.setView('board') },
            { id: 'a:list', group: 'Actions' as const, label: 'Switch to List view', hint: 'L', icon: <Rows size={15} />, run: () => ui.setView('list') },
          ]
        : []),
      { id: 'a:sidebar', group: 'Actions', label: 'Toggle sidebar', hint: '[', icon: <PanelLeft size={15} />, run: () => ui.toggleSidebar() },
    ];
    const lists: Item[] = [...visibleListIds(state, state.currentUserId)]
      .map((id) => state.containers[id]!)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((l) => ({
        id: `l:${l.id}`,
        group: 'Lists' as const,
        label: l.name,
        hint: listPrefix(l.name),
        icon: <ListIcon size={15} />,
        run: () => void ui.selectList(l.id),
      }));
    const tasks: Item[] = hits.map((h) => ({
      id: `t:${h.task.id}`,
      group: 'Tasks' as const,
      label: h.task.title,
      hint: `${listPrefix(h.list.name)}-${h.task.number}`,
      icon: (
        <span className="flex items-center gap-1.5">
          <TaskTypeIcon type={h.task.type} />
          {h.status && <StatusDot status={h.status} />}
        </span>
      ),
      run: async () => {
        await useUiStore.getState().selectList(h.list.id);
        useUiStore.getState().openTask(h.task.id);
      },
    }));
    return [...actions.filter((a) => match(a.label)), ...lists.filter((l) => match(l.label) || match(l.hint ?? '')), ...tasks];
  }, [query, hits, state, selectedListId]);

  const groups = (['Actions', 'Lists', 'Tasks'] as const).map((g) => [g, items.filter((i) => i.group === g)] as const).filter(([, xs]) => xs.length);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} className="relative z-[80]">
      <DialogBackdrop className="fixed inset-0 bg-ink/40 animate-fade-in" />
      <div className="fixed inset-0 flex items-start justify-center p-4 pt-[12vh]">
        <DialogPanel className="w-full max-w-xl overflow-hidden rounded-panel bg-surface shadow-lift ring-1 ring-black/5 animate-fade-in" data-testid="command-palette">
          <Combobox<Item | null>
            value={null}
            onChange={(item) => {
              if (!item) return;
              setOpen(false);
              item.run();
            }}
          >
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search size={16} className="text-ink-subtle" />
              <ComboboxInput
                autoFocus
                aria-label="Search commands, lists and tasks"
                placeholder="Search tasks, lists or actions…"
                className="h-12 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-0"
                onChange={(e) => setQuery(e.target.value)}
                displayValue={() => query}
              />
              <Kbd>Esc</Kbd>
            </div>
            <ComboboxOptions static className="max-h-[50vh] overflow-y-auto p-1.5 focus:outline-none">
              {groups.length === 0 && <p className="px-3 py-6 text-center text-sm text-ink-muted">No matches for “{query.trim()}”.</p>}
              {groups.map(([group, xs]) => (
                <div key={group} className="pb-1">
                  <p className="px-2.5 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-ink-subtle">{group}</p>
                  {xs.map((item) => (
                    <ComboboxOption
                      key={item.id}
                      value={item}
                      className={cx('flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm text-ink data-[focus]:bg-brand-50 data-[focus]:text-brand-800')}
                    >
                      <span className="flex w-8 shrink-0 justify-center text-ink-muted">{item.icon}</span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.hint && <span className="shrink-0 text-2xs font-semibold text-ink-subtle">{item.hint}</span>}
                    </ComboboxOption>
                  ))}
                </div>
              ))}
            </ComboboxOptions>
          </Combobox>
          <div className="flex items-center gap-3 border-t border-line bg-canvas px-4 py-2 text-2xs text-ink-subtle">
            <span>↑↓ to move</span>
            <span>↵ to open</span>
            <span className="ml-auto">
              <Kbd>⌘</Kbd> <Kbd>K</Kbd> anywhere
            </span>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
