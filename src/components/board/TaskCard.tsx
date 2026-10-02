import { memo, type KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, User } from '@/domain/types';
import { AvatarStack, DueDate, PriorityBadge } from '@/components/ui/primitives';
import { Subtasks } from '@/ui/icons';
import { PRIORITY_META, cx } from '@/ui/tokens';

export interface TaskCardProps {
  task: Task;
  assignees: User[];
  done: boolean;
  subtasks?: { done: number; total: number };
}

/** Presentational card (also used inside the DragOverlay). */
export const TaskCardBody = memo(function TaskCardBody({ task, assignees, done, subtasks, lifted }: TaskCardProps & { lifted?: boolean }) {
  return (
    <div
      className={cx(
        'group relative rounded-card bg-surface p-3 shadow-card ring-1 ring-line transition-shadow',
        lifted ? 'rotate-[1.5deg] cursor-grabbing shadow-lift ring-brand-300' : 'hover:shadow-card-hover hover:ring-line-strong',
      )}
    >
      {task.priority === 'urgent' && <span className="absolute inset-y-3 left-0 w-[3px] rounded-r bg-rose-500" aria-hidden />}
      <p className={cx('text-sm font-medium leading-snug text-ink', done && 'text-ink-muted line-through decoration-ink-subtle/60')}>
        {task.title}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <PriorityBadge priority={task.priority} compact />
        <DueDate iso={task.dueDate} done={done} />
        {subtasks && subtasks.total > 0 && (
          <span className="inline-flex items-center gap-1 text-2xs font-medium text-ink-muted" title="Subtasks done">
            <Subtasks size={12} />
            {subtasks.done}/{subtasks.total}
          </span>
        )}
        <span className="ml-auto">
          <AvatarStack users={assignees} />
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
      aria-label={`${props.task.title}. Press Enter to open, Space to drag.`}
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
