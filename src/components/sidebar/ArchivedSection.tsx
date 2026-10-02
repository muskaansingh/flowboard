import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { notify } from '@/store/toastStore';
import { selectArchived, useSelector } from '@/store/selectors';
import { confirmAction } from '@/components/ui/overlays';
import { pathTo } from '@/domain/tree';
import { Archive, ChevronRight, Refresh, Undo } from '@/ui/icons';
import { cx } from '@/ui/tokens';

/** Admin-only footer: archived items (restore) + demo reset. */
export function ArchivedSection() {
  const archived = useSelector(selectArchived);
  const containers = useAppStore((s) => s.containers);
  const [open, setOpen] = useState(false);

  const reset = async () => {
    const ok = await confirmAction({
      title: 'Reset demo data?',
      message: 'All changes (tasks, lists, grants) will be replaced with the original seed data.',
      confirmLabel: 'Reset',
    });
    if (ok) {
      useAppStore.getState().resetDemo();
      notify({ data: null }, 'Demo data restored');
    }
  };

  return (
    <div className="border-t border-white/5 p-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-ink-inverse/60 hover:bg-sidebar-hover hover:text-ink-inverse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <ChevronRight size={12} className={cx('transition-transform', open && 'rotate-90')} />
        <Archive size={13} />
        <span className="flex-1 text-left">Archived</span>
        <span className="tabular-nums text-ink-inverse/40">{archived.length}</span>
      </button>
      {open && (
        <ul className="mt-1 space-y-px">
          {archived.length === 0 && <li className="px-3 py-2 text-2xs text-ink-inverse/40">Nothing archived.</li>}
          {archived.map((c) => (
            <li key={c.id} className="group flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-ink-inverse/70 hover:bg-sidebar-hover">
              <div className="min-w-0 flex-1">
                <p className="truncate">{c.name}</p>
                <p className="truncate text-2xs text-ink-inverse/40">
                  {c.type} · in {pathTo(containers, c.id).slice(1, -1).map((p) => p.name).join(' › ') || 'workspace'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => notify(useAppStore.getState().restoreContainer(c.id), `Restored “${c.name}”`)}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-medium text-brand-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400"
              >
                <Undo size={11} /> Restore
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-ink-inverse/40 hover:bg-sidebar-hover hover:text-ink-inverse/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <Refresh size={12} />
        Reset demo data
      </button>
    </div>
  );
}
