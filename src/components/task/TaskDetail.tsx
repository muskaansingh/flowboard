import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { DialogTitle } from '@headlessui/react';
import { PRIORITIES, TASK_TYPES, type ID, type Priority, type TaskType } from '@/domain/types';
import type { Result } from '@/domain/result';
import { LIMITS } from '@/domain/validation';
import { useAppStore } from '@/store/appStore';
import { toast } from '@/store/toastStore';
import { useUiStore } from '@/store/uiStore';
import type { TaskDetailModel } from '@/store/selectors';
import { taskKey } from '@/domain/taskKey';
import type { UpdateTaskPatch } from '@/domain/commands/tasks';
import { Avatar, Button, FieldError, IconButton, Skeleton, TaskTypeIcon, inputBase, labelClass } from '@/components/ui/primitives';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { ArrowDown, ArrowUp, Check, CheckCircle, Copy, Flag, ListIcon, Trash, X } from '@/ui/icons';
import { PRIORITY_META, TYPE_META, cx } from '@/ui/tokens';
import { SubtaskList } from './SubtaskList';
import { dueDatePreset, toggleTaskDone, withUndo } from './taskActions';
import { LabelPicker, PointsInput, StatusButton } from './fields';
import { ActivitySection } from './Activity';

// The editor (Tiptap/ProseMirror) is large — load it the first time a task is opened.
const RichTextEditor = lazy(() => import('@/components/ui/RichTextEditor').then((m) => ({ default: m.RichTextEditor })));

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-1.5">
      <span className="flex h-8 items-center text-xs font-medium text-ink-muted" title={hint}>
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export interface TaskNav {
  index: number;
  total: number;
  prev?: ID;
  next?: ID;
}

export function TaskDetail({ detail, onClose, nav }: { detail: TaskDetailModel; onClose: () => void; nav?: TaskNav }) {
  const { task, statuses, assignable, moveTargets, subtasks, parent, list, key, comments, history, knownLabels } = detail;
  const containers = useAppStore((s) => s.containers);
  const users = useAppStore((s) => s.users);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const isDone = statuses.find((s) => s.id === task.statusId)?.category === 'done';
  const canAssignMe = assignable.some((u) => u.id === currentUserId) && !task.assigneeIds.includes(currentUserId);
  const openTask = useUiStore((s) => s.openTask);
  const [title, setTitle] = useState(task.title);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editingVersion = useRef<number | null>(null);
  const titleFocused = useRef(false);

  // Keep drafts in sync with external changes (e.g. another tab) unless the user is editing.
  useEffect(() => {
    if (!titleFocused.current) setTitle(task.title);
  }, [task.title]);

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
    // Deleting is undoable from the toast (restores the task, its subtasks and comments).
    if (!withUndo(`Deleted ${key}`, () => useAppStore.getState().deleteTask(task.id), `“${task.title}”`).error) onClose();
  };

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#/list/${task.primaryListId}/task/${task.id}`;
    void navigator.clipboard?.writeText(url).then(
      () => toast.success('Link copied', key),
      () => toast.info('Copy this link', url),
    );
  };

  const titleTooLong = title.trim().length > LIMITS.taskTitle;

  const details = (
    <div className="rounded-card bg-surface ring-1 ring-line">
      <h3 className="border-b border-line px-3 py-2 text-xs font-semibold text-ink">Details</h3>
      <div className="space-y-0.5 p-1.5">
        <Row label="Assignee" hint="Only people with access to this list can be assigned.">
          <SelectMenu
            size="sm"
            variant="ghost"
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
          {canAssignMe && (
            <button
              type="button"
              onClick={() => save({ assigneeIds: [...task.assigneeIds, currentUserId] }, 'assigneeIds')}
              className="ml-2.5 text-2xs font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              title="Assign me (M)"
            >
              Assign to me
            </button>
          )}
          <FieldError message={errors.assigneeIds} />
        </Row>
        <Row label="Priority">
          <SelectMenu<Priority>
            size="sm"
            variant="ghost"
            label="Priority"
            value={task.priority}
            options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label, icon: <Flag size={13} className={PRIORITY_META[p].icon} /> }))}
            onChange={(priority) => save({ priority }, 'priority')}
          />
        </Row>
        <Row label="Type">
          <SelectMenu<TaskType>
            size="sm"
            variant="ghost"
            label="Type"
            value={task.type}
            options={TASK_TYPES.map((t) => ({ value: t, label: TYPE_META[t].label, icon: <TaskTypeIcon type={t} /> }))}
            onChange={(type) => save({ type }, 'type')}
          />
        </Row>
        <Row label="Story points">
          <PointsInput value={task.points} onCommit={(points) => save({ points }, 'points')} />
          <FieldError message={errors.points} />
        </Row>
        <Row label="Labels">
          <LabelPicker value={task.labels} suggestions={knownLabels} onChange={(labels) => save({ labels }, 'labels')} />
          <FieldError message={errors.labels} />
        </Row>
        <Row label="Due date">
          <div className="flex flex-wrap items-center gap-x-0.5">
            <div className="flex w-full items-center">
              <input
                type="datetime-local"
                aria-label="Due date"
                className={cx(inputBase, 'h-8 min-w-0 flex-1 px-2.5 py-1 text-xs shadow-none ring-transparent hover:bg-canvas hover:ring-transparent')}
                value={toLocalInput(task.dueDate)}
                onChange={(e) => save({ dueDate: fromLocalInput(e.target.value) }, 'dueDate')}
              />
              {task.dueDate && (
                <button
                  type="button"
                  aria-label="Clear due date"
                  title="Clear due date"
                  onClick={() => save({ dueDate: null }, 'dueDate')}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-subtle hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {(
              [
                ['today', 'Today'],
                ['tomorrow', 'Tomorrow'],
                ['nextWeek', 'Next week'],
              ] as const
            ).map(([kind, text]) => (
              <button
                key={kind}
                type="button"
                onClick={() => save({ dueDate: dueDatePreset(kind) }, 'dueDate')}
                className="h-6 rounded-md px-1.5 text-2xs font-medium text-ink-muted hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                {text}
              </button>
            ))}
          </div>
          <FieldError message={errors.dueDate} />
        </Row>
        {!task.parentTaskId && (
          <Row label="List">
            <SelectMenu
              size="sm"
              variant="ghost"
              label="Move to list"
              value={task.primaryListId}
              options={moveTargets.map((l) => ({ value: l.id, label: l.name }))}
              onChange={moveTo}
            />
          </Row>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Header: breadcrumb + key, then actions */}
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 sm:px-5">
        <nav aria-label="Task location" className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-ink-muted">
          <ListIcon size={13} className="shrink-0" />
          <span className="truncate">{list.name}</span>
          <span className="text-ink-subtle">/</span>
          {parent && (
            <>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 font-medium text-ink-muted hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                onClick={() => useUiStore.getState().openTask(parent.id)}
                title={parent.title}
              >
                <TaskTypeIcon type={parent.type} />
                {taskKey(parent, containers)}
              </button>
              <span className="text-ink-subtle">/</span>
            </>
          )}
          <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-ink" data-testid="task-key">
            <TaskTypeIcon type={task.type} />
            {key}
          </span>
          <IconButton label="Copy link to task" onClick={copyLink} className="h-6 w-6">
            <Copy size={12} />
          </IconButton>
        </nav>
        <span
          className={cx('hidden items-center gap-1 text-2xs font-medium text-emerald-600 transition-opacity sm:flex', saved ? 'opacity-100' : 'opacity-0')}
          aria-live="polite"
        >
          <Check size={12} /> Saved
        </span>
        {nav && nav.total > 1 && (
          <span className="flex items-center">
            <IconButton label="Previous task (K)" disabled={!nav.prev} className="disabled:opacity-30" onClick={() => nav.prev && openTask(nav.prev)}>
              <ArrowUp size={14} />
            </IconButton>
            <span className="px-0.5 text-2xs tabular-nums text-ink-subtle">
              {nav.index + 1}/{nav.total}
            </span>
            <IconButton label="Next task (J)" disabled={!nav.next} className="disabled:opacity-30" onClick={() => nav.next && openTask(nav.next)}>
              <ArrowDown size={14} />
            </IconButton>
          </span>
        )}
        <IconButton label="Close task" onClick={onClose} data-autofocus>
          <X />
        </IconButton>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden">
        {/* Main column */}
        <div className="min-w-0 space-y-6 px-5 py-5 sm:px-6 lg:overflow-y-auto">
          <div>
            <DialogTitle className="sr-only">
              {key} {task.title}
            </DialogTitle>
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
                if (e.key === 'Escape') {
                  // First Esc discards the draft; the next one closes the task.
                  e.preventDefault();
                  e.stopPropagation();
                  setTitle(task.title);
                  titleFocused.current = false;
                  setErrors((x) => ({ ...x, title: '' }));
                  requestAnimationFrame(() => (e.target as HTMLTextAreaElement).blur());
                }
              }}
              className={cx(
                'block w-full resize-none rounded-lg border-0 bg-transparent px-2 py-1 -mx-2 text-2xl font-semibold leading-snug text-ink [field-sizing:content] hover:bg-canvas focus:bg-surface focus:outline-none focus:ring-2',
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

          <div>
            <p className={labelClass}>Description</p>
            <Suspense fallback={<Skeleton className="h-16 w-full" />}>
              <RichTextEditor
                value={task.description}
                onEditStart={() => {
                  editingVersion.current = task.version;
                }}
                onSave={(html) => {
                  if (html !== task.description) save({ description: html }, 'description');
                  else editingVersion.current = null;
                }}
              />
            </Suspense>
            <FieldError message={errors.description} />
          </div>

          {!task.parentTaskId && <SubtaskList parent={task} subtasks={subtasks} statuses={statuses} />}

          <ActivitySection taskId={task.id} comments={comments} history={history} people={assignable} />
        </div>

        {/* Side panel: status + details (shown first on small screens) */}
        <aside className="order-first space-y-4 border-b border-line bg-canvas/60 px-5 py-4 lg:order-none lg:overflow-y-auto lg:border-b-0 lg:border-l">
          <div className="flex flex-wrap items-center gap-2">
            <StatusButton statuses={statuses} value={task.statusId} onChange={(statusId) => save({ statusId }, 'statusId')} />
            <Button
              size="sm"
              variant={isDone ? 'secondary' : 'ghost'}
              icon={<CheckCircle size={13} />}
              className={cx('h-8', isDone && '!text-emerald-700')}
              onClick={() => toggleTaskDone(task.id)}
              title="Toggle complete (C)"
            >
              {isDone ? 'Completed' : 'Complete'}
            </Button>
          </div>

          {details}

          <div className="space-y-1 px-1 text-2xs text-ink-subtle">
            <p>Created {new Date(task.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
            <p>Updated {new Date(task.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
          </div>

          <div className="flex items-center gap-2 border-t border-line pt-3">
            {confirmDelete ? (
              <>
                <p className="flex-1 text-xs font-medium text-rose-700">
                  Delete{subtasks.length ? ` with ${subtasks.length} subtask${subtasks.length === 1 ? '' : 's'}` : ''}?
                </p>
                <Button size="sm" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button size="sm" variant="danger" onClick={remove} autoFocus>
                  Delete
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" icon={<Trash size={13} />} className="hover:!bg-rose-50 hover:!text-rose-700" onClick={() => setConfirmDelete(true)}>
                  Delete task
                </Button>
                <span
                  tabIndex={0}
                  className="ml-auto hidden cursor-help rounded px-1.5 text-2xs font-semibold text-ink-subtle ring-1 ring-inset ring-line hover:text-ink sm:inline-block"
                  title="Keyboard shortcuts: J/K next/prev · C complete · M assign me · 1–5 priority · Esc close"
                  aria-label="Keyboard shortcuts: J and K next or previous, C complete, M assign me, 1 to 5 priority, Escape close"
                >
                  ?
                </span>
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
