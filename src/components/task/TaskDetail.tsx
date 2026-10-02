import { useEffect, useRef, useState } from 'react';
import { DialogTitle } from '@headlessui/react';
import { PRIORITIES, type ID, type Priority } from '@/domain/types';
import type { Result } from '@/domain/result';
import { LIMITS } from '@/domain/validation';
import { useAppStore } from '@/store/appStore';
import { notify, toast } from '@/store/toastStore';
import { useUiStore } from '@/store/uiStore';
import type { TaskDetailModel } from '@/store/selectors';
import type { UpdateTaskPatch } from '@/domain/commands/tasks';
import { Avatar, Button, FieldError, IconButton, StatusDot, inputBase, inputClass, labelClass } from '@/components/ui/primitives';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Calendar, Check, Flag, ListIcon, Trash, Users, X } from '@/ui/icons';
import { PRIORITY_META, cx } from '@/ui/tokens';
import { SubtaskList } from './SubtaskList';

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] items-center gap-3">
      <span className="flex items-center gap-2 text-xs font-medium text-ink-muted">
        <span className="text-ink-subtle">{icon}</span>
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function TaskDetail({ detail, onClose }: { detail: TaskDetailModel; onClose: () => void }) {
  const { task, statuses, assignable, moveTargets, subtasks, parent, list } = detail;
  const users = useAppStore((s) => s.users);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editingVersion = useRef<number | null>(null);
  const titleFocused = useRef(false);
  const descFocused = useRef(false);

  // Keep drafts in sync with external changes (e.g. another tab) unless the user is editing.
  useEffect(() => {
    if (!titleFocused.current) setTitle(task.title);
    if (!descFocused.current) setDescription(task.description);
  }, [task.title, task.description]);

  const save = (patch: UpdateTaskPatch, field: string) => {
    const expectedVersion = editingVersion.current ?? task.version;
    const res = useAppStore.getState().updateTask(task.id, patch, { expectedVersion });
    editingVersion.current = null;
    handle(res, field);
    return res;
  };

  const handle = (res: Result<unknown>, field: string) => {
    if (res.error) {
      if (res.error.code === 'CONFLICT') {
        toast.error(res.error);
        const latest = useAppStore.getState().tasks[task.id];
        if (latest) {
          setTitle(latest.title);
          setDescription(latest.description);
        }
      } else if (res.error.fields) {
        setErrors((e) => ({ ...e, ...res.error!.fields }));
      } else {
        toast.error(res.error);
      }
      return false;
    }
    setErrors((e) => {
      const next = { ...e };
      delete next[field];
      return next;
    });
    setSaved(Date.now());
    return true;
  };

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 1500);
    return () => clearTimeout(t);
  }, [saved]);

  const commitTitle = () => {
    titleFocused.current = false;
    if (title.trim() === task.title) {
      setErrors((e) => ({ ...e, title: '' }));
      return;
    }
    const res = save({ title }, 'title');
    if (res.error && res.error.code !== 'CONFLICT' && !res.error.fields) setTitle(task.title);
  };

  const commitDescription = () => {
    descFocused.current = false;
    if (description !== task.description) save({ description }, 'description');
  };

  const moveTo = (listId: ID) => {
    if (listId === task.primaryListId) return;
    const res = useAppStore.getState().moveTask(task.id, { listId });
    if (!handle(res, 'list') || !res.data) return;
    const target = moveTargets.find((l) => l.id === listId);
    const dropped = res.data.unassigned.map((u) => users[u]?.name.split(' ')[0]).filter(Boolean);
    toast.success(
      `Moved to ${target?.name ?? 'list'}`,
      dropped.length ? `${dropped.join(', ')} unassigned — no access to that list.` : undefined,
    );
    void useUiStore.getState().selectList(listId).then(() => useUiStore.getState().openTask(task.id));
  };

  const remove = () => {
    if (notify(useAppStore.getState().deleteTask(task.id), `Deleted “${task.title}”`)) onClose();
  };

  const titleTooLong = title.trim().length > LIMITS.taskTitle;

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-ink-muted">
          <ListIcon size={13} />
          <span className="truncate">{list.name}</span>
          {parent && (
            <>
              <span className="text-ink-subtle">/</span>
              <button
                type="button"
                className="truncate font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                onClick={() => useUiStore.getState().openTask(parent.id)}
              >
                {parent.title}
              </button>
            </>
          )}
        </div>
        <span
          className={cx('flex items-center gap-1 text-2xs font-medium text-emerald-600 transition-opacity', saved ? 'opacity-100' : 'opacity-0')}
          aria-live="polite"
        >
          <Check size={12} /> Saved
        </span>
        <IconButton label="Close task" onClick={onClose} data-autofocus>
          <X />
        </IconButton>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {/* Title */}
        <div>
          <DialogTitle className="sr-only">{task.title}</DialogTitle>
          <textarea
            aria-label="Task title"
            rows={1}
            value={title}
            onFocus={() => {
              titleFocused.current = true;
              editingVersion.current = task.version;
            }}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors((x) => ({ ...x, title: '' }));
            }}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.currentTarget as HTMLTextAreaElement).blur();
              }
            }}
            className={cx(
              'block w-full resize-none rounded-lg border-0 bg-transparent px-2 py-1 -mx-2 text-xl font-semibold leading-snug text-ink [field-sizing:content] hover:bg-canvas focus:bg-surface focus:outline-none focus:ring-2',
              errors.title || titleTooLong ? 'ring-2 ring-rose-400 focus:ring-rose-500' : 'focus:ring-brand-500',
            )}
            aria-invalid={!!errors.title || titleTooLong}
            aria-describedby="title-help"
          />
          <div id="title-help" className="flex justify-between">
            <FieldError message={errors.title || (titleTooLong ? `Max ${LIMITS.taskTitle} characters.` : undefined)} />
            {title.length > LIMITS.taskTitle - 80 && (
              <span className={cx('mt-1 ml-auto text-2xs tabular-nums', titleTooLong ? 'text-rose-600' : 'text-ink-subtle')}>
                {title.trim().length}/{LIMITS.taskTitle}
              </span>
            )}
          </div>
        </div>

        {/* Properties */}
        <div className="space-y-3">
          <Row icon={<StatusDot status={statuses.find((s) => s.id === task.statusId) ?? { color: 'slate' }} />} label="Status">
            <SelectMenu
              label="Status"
              value={task.statusId}
              options={statuses.map((s) => ({ value: s.id, label: s.name, icon: <StatusDot status={s} /> }))}
              onChange={(statusId) => save({ statusId }, 'statusId')}
            />
          </Row>
          <Row icon={<Flag size={14} />} label="Priority">
            <SelectMenu<Priority>
              label="Priority"
              value={task.priority}
              options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label, icon: <Flag size={13} className={PRIORITY_META[p].icon} /> }))}
              onChange={(priority) => save({ priority }, 'priority')}
            />
          </Row>
          <Row icon={<Users size={14} />} label="Assignees">
            <SelectMenu
              multiple
              label="Assignees"
              placeholder="Unassigned"
              value={task.assigneeIds}
              options={assignable.map((u) => ({ value: u.id, label: u.name, hint: u.role === 'admin' ? 'Admin' : 'Member', icon: <Avatar user={u} size="xs" /> }))}
              renderValue={(sel) =>
                sel.map((o) => (
                  <span key={o.value} className="inline-flex items-center gap-1 rounded-pill bg-canvas py-0.5 pl-0.5 pr-2 text-xs ring-1 ring-line">
                    {o.icon}
                    {o.label.split(' ')[0]}
                  </span>
                ))
              }
              onChange={(assigneeIds) => save({ assigneeIds }, 'assigneeIds')}
            />
            <FieldError message={errors.assigneeIds} />
            <p className="mt-1 text-2xs text-ink-subtle">Only people with access to this list can be assigned.</p>
          </Row>
          <Row icon={<Calendar size={14} />} label="Due date">
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                aria-label="Due date"
                className={cx(inputBase, 'h-9 min-w-0 flex-1 py-1.5 shadow-none')}
                value={toLocalInput(task.dueDate)}
                onChange={(e) => save({ dueDate: fromLocalInput(e.target.value) }, 'dueDate')}
              />
              {task.dueDate && (
                <Button size="sm" variant="ghost" onClick={() => save({ dueDate: null }, 'dueDate')}>
                  Clear
                </Button>
              )}
            </div>
            <FieldError message={errors.dueDate} />
          </Row>
          {!task.parentTaskId && (
            <Row icon={<ListIcon size={14} />} label="List">
              <SelectMenu
                label="Move to list"
                value={task.primaryListId}
                options={moveTargets.map((l) => ({ value: l.id, label: l.name }))}
                onChange={moveTo}
              />
            </Row>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="task-description" className={labelClass}>
            Description
          </label>
          <textarea
            id="task-description"
            rows={5}
            placeholder="Add more detail…"
            value={description}
            onFocus={() => {
              descFocused.current = true;
              editingVersion.current = task.version;
            }}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={commitDescription}
            className={cx(inputClass, 'resize-y leading-relaxed shadow-none')}
          />
          <FieldError message={errors.description} />
        </div>

        {!task.parentTaskId && <SubtaskList parent={task} subtasks={subtasks} statuses={statuses} />}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 border-t border-line bg-canvas px-5 py-3">
        {confirmDelete ? (
          <>
            <p className="flex-1 text-xs font-medium text-rose-700">
              Delete this task{subtasks.length ? ` and its ${subtasks.length} subtask(s)` : ''}? This can’t be undone.
            </p>
            <Button size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" onClick={remove} autoFocus>
              Delete task
            </Button>
          </>
        ) : (
          <>
            <p className="flex-1 text-2xs text-ink-subtle">
              Created {new Date(task.createdAt).toLocaleDateString()} · Updated {new Date(task.updatedAt).toLocaleString()}
            </p>
            <Button size="sm" variant="ghost" icon={<Trash size={13} />} className="hover:!bg-rose-50 hover:!text-rose-700" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </>
        )}
      </div>
    </>
  );
}
