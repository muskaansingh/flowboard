import type { SyntheticEvent } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { PRIORITIES, type ID, type Priority } from '@/domain/types';
import { useAppStore } from '@/store/appStore';
import { notify } from '@/store/toastStore';
import { PriorityBadge } from '@/components/ui/primitives';
import { Check, Flag } from '@/ui/icons';
import { PRIORITY_META, cx } from '@/ui/tokens';

const stop = (e: SyntheticEvent) => e.stopPropagation();

/**
 * Clickable priority badge for cards: opens a menu to change priority in place.
 * Swallows pointer/keyboard/click events so it never starts a drag or opens the drawer.
 */
export function PriorityMenu({ taskId, priority, compact = false }: { taskId: ID; priority: Priority; compact?: boolean }) {
  const set = (next: Priority) => {
    if (next !== priority) notify(useAppStore.getState().updateTask(taskId, { priority: next }));
  };

  return (
    <Menu>
      <span onPointerDown={stop} onClick={stop} onKeyDown={stop} className="contents">
        <MenuButton
          aria-label={`Priority: ${PRIORITY_META[priority].label}. Change priority`}
          title="Change priority"
          className={cx(
            'rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 data-[open]:ring-2 data-[open]:ring-brand-400',
            compact
              ? cx('inline-flex h-6 w-6 items-center justify-center hover:bg-black/5', priority === 'none' && 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[open]:opacity-100')
              : priority === 'none'
                ? 'inline-flex h-5 items-center px-1 text-ink-subtle opacity-0 hover:bg-black/5 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 data-[open]:opacity-100'
                : 'hover:brightness-95',
          )}
        >
          {compact ? <Flag size={13} className={PRIORITY_META[priority].icon} /> : priority === 'none' ? <Flag size={12} /> : <PriorityBadge priority={priority} compact />}
        </MenuButton>
        <MenuItems
          anchor="bottom start"
          className="z-50 w-40 rounded-card bg-surface p-1 shadow-pop ring-1 ring-black/5 focus:outline-none [--anchor-gap:4px]"
        >
          <p className="px-2.5 pb-1 pt-1 text-2xs font-medium uppercase tracking-wide text-ink-subtle">Priority</p>
          {PRIORITIES.map((p) => (
            <MenuItem key={p}>
              <button
                type="button"
                onClick={() => set(p)}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-ink data-[focus]:bg-canvas"
              >
                <Flag size={13} className={PRIORITY_META[p].icon} />
                <span className="flex-1">{PRIORITY_META[p].label}</span>
                {p === priority && <Check size={14} className="text-brand-600" />}
              </button>
            </MenuItem>
          ))}
        </MenuItems>
      </span>
    </Menu>
  );
}
