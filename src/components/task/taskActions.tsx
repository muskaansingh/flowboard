import type { ID } from '@/domain/types';
import type { SyntheticEvent } from 'react';
import { Check } from '@/ui/icons';
import { cx } from '@/ui/tokens';
import { useAppStore } from '@/store/appStore';
import { notify, toast } from '@/store/toastStore';
import type { Result } from '@/domain/result';

/** Flips a task between its list's first "done" status and first "to do" status. */
export function toggleTaskDone(taskId: ID) {
  const s = useAppStore.getState();
  const task = s.tasks[taskId];
  if (!task) return;
  const statuses = Object.values(s.statuses)
    .filter((st) => st.listId === task.primaryListId)
    .sort((a, b) => a.position - b.position);
  const isDone = s.statuses[task.statusId]?.category === 'done';
  const target = statuses.find((st) => st.category === (isDone ? 'todo' : 'done'));
  if (!target) return;
  withUndo(isDone ? 'Reopened' : 'Marked complete', () => s.moveTask(taskId, { statusId: target.id }));
}

/** Due-date presets, set to 5pm local so they read as "by end of day". */
export function dueDatePreset(kind: 'today' | 'tomorrow' | 'nextWeek', now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0);
  if (kind === 'tomorrow') d.setDate(d.getDate() + 1);
  if (kind === 'nextWeek') d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); // next Monday
  return d.toISOString();
}

const stop = (e: SyntheticEvent) => e.stopPropagation();

/**
 * Round "complete" toggle for cards and rows. Swallows pointer/keyboard events so it
 * doesn't start a drag or open the drawer underneath it.
 */
export function DoneToggle({ taskId, title, done, className }: { taskId: ID; title: string; done: boolean; className?: string }) {
  return (
    <button
      type="button"
      aria-label={done ? `Reopen ${title}` : `Complete ${title}`}
      title={done ? 'Reopen' : 'Mark complete'}
      onPointerDown={stop}
      onKeyDown={stop}
      onClick={(e) => {
        e.stopPropagation();
        toggleTaskDone(taskId);
      }}
      className={cx(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        done ? 'bg-emerald-500 text-white ring-emerald-500' : 'text-transparent ring-ink-subtle/60 hover:bg-emerald-50 hover:text-emerald-600 hover:ring-emerald-500',
        className,
      )}
    >
      <Check size={10} />
    </button>
  );
}

/**
 * Runs a task mutation with an Undo toast. Undo restores the pre-action snapshot only if nothing
 * else changed tasks in between (otherwise it explains why it can't).
 */
export function withUndo<T>(title: string, action: () => Result<T>, message?: string): Result<T> {
  const store = useAppStore.getState();
  const before = store.snapshot();
  const res = action();
  if (res.error) {
    toast.error(res.error);
    return res;
  }
  const after = useAppStore.getState().tasks;
  toast.undoable(title, () => notify(useAppStore.getState().undo(before, after), 'Undone'), message);
  return res;
}
