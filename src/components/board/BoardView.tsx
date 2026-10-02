import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ID, Status, Task, User } from '@/domain/types';
import { useAppStore } from '@/store/appStore';
import { notify, toast } from '@/store/toastStore';
import { useUiStore } from '@/store/uiStore';
import type { ListViewModel } from '@/store/selectors';
import { STATUS_STYLES, cx } from '@/ui/tokens';
import { SortableTaskCard, TaskCardBody } from './TaskCard';
import { QuickAdd } from './QuickAdd';

const COLUMN_PREFIX = 'col:';
type Columns = Record<ID, ID[]>;

function Column({
  status,
  taskIds,
  tasks,
  users,
  vm,
  isOver,
  onOpen,
}: {
  status: Status;
  taskIds: ID[];
  tasks: Record<ID, Task>;
  users: Record<ID, User>;
  vm: ListViewModel;
  isOver: boolean;
  onOpen: (id: ID) => void;
}) {
  const { setNodeRef } = useDroppable({ id: COLUMN_PREFIX + status.id, data: { type: 'column' } });
  const styles = STATUS_STYLES[status.color];
  return (
    <section
      aria-label={`${status.name} column`}
      data-testid={`column-${status.name}`}
      className={cx(
        'flex max-h-full w-[17rem] shrink-0 flex-col rounded-panel transition-colors',
        isOver ? 'bg-brand-50 ring-2 ring-inset ring-brand-300' : 'bg-black/[0.03]',
      )}
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <span className={cx('h-2 w-2 rounded-full', styles.dot)} />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{status.name}</h3>
        <span className="rounded-pill bg-black/5 px-1.5 text-2xs font-semibold tabular-nums text-ink-muted">{taskIds.length}</span>
      </header>
      <div ref={setNodeRef} className="flex min-h-[3rem] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {taskIds.map((id) => {
            const t = tasks[id];
            if (!t) return null;
            return (
              <SortableTaskCard
                key={id}
                task={t}
                assignees={t.assigneeIds.map((u) => users[u]!).filter(Boolean)}
                done={status.category === 'done'}
                subtasks={vm.subtaskCounts[id]}
                onOpen={onOpen}
              />
            );
          })}
        </SortableContext>
        {taskIds.length === 0 && (
          <div
            className={cx(
              'flex flex-1 items-center justify-center rounded-card border border-dashed px-3 py-6 text-center text-xs transition-colors',
              isOver ? 'border-brand-400 text-brand-700' : 'border-line-strong text-ink-subtle',
            )}
          >
            {isOver ? 'Drop here' : 'No tasks'}
          </div>
        )}
      </div>
      <div className="px-2 pb-2">
        <QuickAdd listId={vm.list.id} statusId={status.id} statusName={status.name} />
      </div>
    </section>
  );
}

/**
 * Kanban board. During a drag we keep a local *preview* of column membership so cards shift
 * live across columns; on drop we commit a single `moveTask` to the store. If the store rejects
 * the move (e.g. permission revoked) the preview is discarded — i.e. the UI rolls back.
 */
export function BoardView({ vm }: { vm: ListViewModel }) {
  const users = useAppStore((s) => s.users);
  const tasks = useAppStore((s) => s.tasks);
  const openTask = useUiStore((s) => s.openTask);

  const committed: Columns = useMemo(
    () => Object.fromEntries(vm.statuses.map((s) => [s.id, (vm.columns[s.id] ?? []).map((t) => t.id)])),
    [vm],
  );
  const [preview, setPreview] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<ID | null>(null);
  const [overColumn, setOverColumn] = useState<ID | null>(null);
  const columns = preview ?? committed;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  const findColumn = (id: UniqueIdentifier, cols: Columns = columns): ID | undefined => {
    const key = String(id);
    if (key.startsWith(COLUMN_PREFIX)) return key.slice(COLUMN_PREFIX.length);
    return Object.keys(cols).find((col) => cols[col]!.includes(key));
  };

  const reset = () => {
    setPreview(null);
    setActiveId(null);
    setOverColumn(null);
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setPreview(committed);
    setOverColumn(findColumn(active.id, committed) ?? null);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !preview) return;
    const from = findColumn(active.id, preview);
    const to = findColumn(over.id, preview);
    if (!from || !to) return;
    setOverColumn(to);
    if (from === to) return;

    setPreview((prev) => {
      if (!prev) return prev;
      const source = prev[from]!.filter((id) => id !== active.id);
      const target = [...prev[to]!];
      const overIndex = target.indexOf(String(over.id));
      const isBelow =
        over.rect && active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height / 2;
      const insertAt = overIndex >= 0 ? overIndex + (isBelow ? 1 : 0) : target.length;
      target.splice(insertAt, 0, String(active.id));
      return { ...prev, [from]: source, [to]: target };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const cols = preview;
    if (!over || !cols) return reset();
    const taskId = String(active.id);
    const to = findColumn(over.id, cols);
    if (!to) return reset();

    let ids = cols[to]!;
    const oldIndex = ids.indexOf(taskId);
    const overIndex = ids.indexOf(String(over.id));
    if (oldIndex >= 0 && overIndex >= 0 && oldIndex !== overIndex) ids = arrayMove(ids, oldIndex, overIndex);
    const index = ids.indexOf(taskId);

    const res = useAppStore.getState().moveTask(taskId, { statusId: to, index });
    if (res.data && res.data.task.statusId !== tasks[taskId]?.statusId) {
      const status = vm.statuses.find((s) => s.id === to);
      if (status) toast.success(`Moved to ${status.name}`);
    }
    notify(res);
    reset();
  };

  const active = activeId ? tasks[activeId] : undefined;
  const activeStatus = active ? vm.statuses.find((s) => s.id === (overColumn ?? active.statusId)) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
    >
      <div className="flex h-full items-start gap-3 overflow-x-auto px-6 pb-6 pt-1" data-testid="board">
        {vm.statuses.map((status) => (
          <Column
            key={status.id}
            status={status}
            taskIds={columns[status.id] ?? []}
            tasks={tasks}
            users={users}
            vm={vm}
            isOver={activeId !== null && overColumn === status.id}
            onOpen={openTask}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 160, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
        {active ? (
          <div className="w-64">
            <TaskCardBody
              task={active}
              assignees={active.assigneeIds.map((u) => users[u]!).filter(Boolean)}
              done={activeStatus?.category === 'done'}
              subtasks={vm.subtaskCounts[active.id]}
              lifted
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
