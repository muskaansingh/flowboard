import { memo, type KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, User } from '@/domain/types';
import { AvatarStack, DueDate, LabelChip, PointsBadge, PriorityIcon, TaskTypeIcon } from '@/components/ui/primitives';
import { Subtasks } from '@/ui/icons';
import { PRIORITY_META, cx } from '@/ui/tokens';
import { PriorityMenu } from './PriorityMenu';

export interface TaskCardProps {
  task: Task;
  /** Jira-style key, e.g. SPR-12. */
  taskKey: string;
  assignees: User[];
  done: boolean;
  subtasks?: { done: number; total: number };
}

const MAX_LABELS = 2;

/**
 * Presentational card (also used inside the DragOverlay). Jira layout: title, labels, then a
 * footer with type · key on the left and points · priority · assignees on the right.
 */
export const TaskCardBody = memo(function TaskCardBody({ task, taskKey, assignees, done, subtasks, lifted }: TaskCardProps & { lifted?: boolean }) {
  return (
    <div
      className={cx(
        'group relative rounded-card bg-surface px-3 pb-2.5 pt-3 shadow-card ring-1 ring-line transition-shadow',
        lifted ? 'rotate-[1.5deg] cursor-grabbing shadow-lift ring-brand-300' : 'hover:shadow-card-hover hover:ring-line-strong',
      )}
    >
      <p className={cx('line-clamp-3 text-sm leading-snug text-ink', done && 'text-ink-muted')}>{task.title}</p>

      {(task.labels.length > 0 || task.dueDate || (subtasks && subtasks.total > 0)) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {task.labels.slice(0, MAX_LABELS).map((l) => (
            <LabelChip key={l} label={l} />
          ))}
          {task.labels.length > MAX_LABELS && <span className="text-2xs text-ink-subtle">+{task.labels.length - MAX_LABELS}</span>}
          <DueDate iso={task.dueDate} done={done} />
          {subtasks && subtasks.total > 0 && (
            <span className="inline-flex items-center gap-1 text-2xs font-medium text-ink-muted" title="Subtasks done">
              <Subtasks size={12} />
              {subtasks.done}/{subtasks.total}
            </span>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-1.5">
        <TaskTypeIcon type={task.type} />
        <span className={cx('text-2xs font-semibold uppercase tracking-wide text-ink-muted', done && 'line-through decoration-ink-subtle/70')}>
          {taskKey}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <PointsBadge points={task.points} />
          {lifted ? <PriorityIcon priority={task.priority} /> : <PriorityMenu taskId={task.id} priority={task.priority} compact />}
          {assignees.length > 0 ? (
            <AvatarStack users={assignees} max={2} />
          ) : (
            <span className="h-6 w-6 rounded-full border border-dashed border-line-strong" title="Unassigned" aria-label="Unassigned" />
          )}
        </span>
      </div>
      <span className="sr-only">Priority: {PRIORITY_META[task.priority].label}</span>
    </div>
  );
});

/** Sortable wrapper: whole card is the drag handle; click / Enter opens the drawer. */
export function SortableTaskCard({ onOpen, ...props }: TaskCardProps & { onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
    data: { type: 'task' },
  });

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !isDragging) {
      e.preventDefault();
      onOpen(props.task.id);
      return;
    }
    listeners?.onKeyDown?.(e);
  };

  return (
    <div
      ref={setNodeRef}
      // dnd-kit needs inline transform/transition to animate sortable items (documented exception).
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      onClick={() => onOpen(props.task.id)}
      aria-label={`${props.taskKey} ${props.task.title}. Press Enter to open, Space to drag.`}
      data-testid="task-card"
      className={cx(
        'cursor-grab rounded-card outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        isDragging && 'opacity-100',
      )}
    >
      {isDragging ? (
        <div className="rounded-card border-2 border-dashed border-brand-300 bg-brand-50/60">
          <div className="invisible">
            <TaskCardBody {...props} />
          </div>
        </div>
      ) : (
        <TaskCardBody {...props} />
      )}
    </div>
  );
}
