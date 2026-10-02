import { useState, type FormEvent } from 'react';
import type { Status, Task } from '@/domain/types';
import { useAppStore } from '@/store/appStore';
import { notify, toast } from '@/store/toastStore';
import { useUiStore } from '@/store/uiStore';
import { FieldError, IconButton, StatusDot } from '@/components/ui/primitives';
import { Check, Plus, Subtasks, Trash } from '@/ui/icons';
import { cx } from '@/ui/tokens';

/** One level of subtasks: add, toggle done, open, delete. */
export function SubtaskList({ parent, subtasks, statuses }: { parent: Task; subtasks: Task[]; statuses: Status[] }) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string>();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const byId = new Map(statuses.map((s) => [s.id, s]));
  const doneStatus = statuses.find((s) => s.category === 'done');
  const todoStatus = statuses.find((s) => s.category === 'todo');
  const doneCount = subtasks.filter((s) => byId.get(s.statusId)?.category === 'done').length;

  const add = (e: FormEvent) => {
    e.preventDefault();
    const res = useAppStore.getState().createTask(parent.primaryListId, { title, parentTaskId: parent.id });
    if (res.error) {
      setError(res.error.fields?.title ?? res.error.message);
      if (!res.error.fields) toast.error(res.error);
      return;
    }
    setTitle('');
    setError(undefined);
  };

  const toggle = (t: Task) => {
    const isDone = byId.get(t.statusId)?.category === 'done';
    const target = isDone ? todoStatus : doneStatus;
    if (target) notify(useAppStore.getState().moveTask(t.id, { statusId: target.id }));
  };

  return (
    <section aria-label="Subtasks">
      <div className="mb-2 flex items-center gap-2">
        <Subtasks size={14} className="text-ink-subtle" />
        <h3 className="text-xs font-medium text-ink-muted">Subtasks</h3>
        {subtasks.length > 0 && (
          <span className="text-2xs tabular-nums text-ink-subtle">
            {doneCount}/{subtasks.length}
          </span>
        )}
      </div>
      {subtasks.length > 0 && (
        <ul className="mb-2 divide-y divide-line rounded-card ring-1 ring-line">
          {subtasks.map((t) => {
            const st = byId.get(t.statusId);
            const done = st?.category === 'done';
            return (
              <li key={t.id} className="group flex items-center gap-2.5 px-3 py-2">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={`Mark “${t.title}” ${done ? 'not done' : 'done'}`}
                  onClick={() => toggle(t)}
                  className={cx(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                    done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-line-strong hover:border-brand-500',
                  )}
                >
                  {done && <Check size={11} strokeWidth={3} />}
                </button>
                <button
                  type="button"
                  onClick={() => useUiStore.getState().openTask(t.id)}
                  className={cx(
                    'min-w-0 flex-1 truncate text-left text-sm hover:text-brand-700 focus-visible:outline-none focus-visible:underline',
                    done ? 'text-ink-muted line-through' : 'text-ink',
                  )}
                >
                  {t.title}
                </button>
                {st && (
                  <span className="flex items-center gap-1 text-2xs text-ink-subtle">
                    <StatusDot status={st} /> {st.name}
                  </span>
                )}
                {pendingDelete === t.id ? (
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      autoFocus
                      onClick={() => notify(useAppStore.getState().deleteTask(t.id))}
                      className="rounded px-1.5 py-0.5 text-2xs font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(null)}
                      className="rounded px-1.5 py-0.5 text-2xs text-ink-muted hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      Keep
                    </button>
                  </span>
                ) : (
                  <IconButton
                    label={`Delete subtask ${t.title}`}
                    className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100 hover:!bg-rose-50 hover:!text-rose-600"
                    onClick={() => setPendingDelete(t.id)}
                  >
                    <Trash size={13} />
                  </IconButton>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <form onSubmit={add} className="flex items-center gap-2 rounded-lg px-2 ring-1 ring-inset ring-line focus-within:ring-2 focus-within:ring-brand-500">
        <Plus size={14} className="text-ink-subtle" />
        <input
          aria-label="New subtask title"
          placeholder="Add a subtask and press Enter"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(undefined);
          }}
          className="h-9 flex-1 border-0 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-0"
        />
      </form>
      <FieldError message={error} />
    </section>
  );
}
