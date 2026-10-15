import { forwardRef, useImperativeHandle, useRef, useState, type FormEvent } from 'react';
import type { ID } from '@/domain/types';
import { useAppStore } from '@/store/appStore';
import { toast } from '@/store/toastStore';
import { Button, FieldError } from '@/components/ui/primitives';
import { Plus } from '@/ui/icons';
import { cx } from '@/ui/tokens';

export interface QuickAddHandle {
  open: () => void;
}

/** Inline "add task" at the bottom of a kanban column. Enter creates, Escape cancels. */
export const QuickAdd = forwardRef<QuickAddHandle, { listId: ID; statusId: ID; statusName: string }>(function QuickAdd(
  { listId, statusId, statusName },
  ref,
) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true);
      requestAnimationFrame(() => {
        formRef.current?.scrollIntoView({ block: 'nearest' });
        formRef.current?.querySelector('textarea')?.focus();
      });
    },
  }));
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string>();

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const res = useAppStore.getState().createTask(listId, { title, statusId });
    if (res.error) {
      setError(res.error.fields?.title ?? res.error.message);
      if (!res.error.fields) toast.error(res.error);
      return;
    }
    setTitle('');
    setError(undefined);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-subtle transition-colors hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Plus size={14} /> Add task
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      onBlur={(e) => {
        // Clicking away from an empty draft closes it; a typed title is kept until Cancel.
        if (!title.trim() && !e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
          setError(undefined);
        }
      }}
      className="rounded-card bg-surface p-2 shadow-card ring-1 ring-brand-300"
    >
      <textarea
        autoFocus
        rows={2}
        aria-label={`New task title in ${statusName}`}
        placeholder="Task title… (Enter to add, Esc to cancel)"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setError(undefined);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === 'Escape') {
            e.stopPropagation();
            setOpen(false);
            setTitle('');
            setError(undefined);
          }
        }}
        className={cx(
          'block w-full resize-none border-0 bg-transparent p-1 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-0',
        )}
      />
      <FieldError message={error} />
      <div className="mt-1.5 flex items-center justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" type="submit" disabled={!title.trim()}>
          Add
        </Button>
      </div>
    </form>
  );
});
