import { useMemo, useRef, useState } from 'react';
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
import { notify } from '@/store/toastStore';
import { withUndo } from '@/components/task/taskActions';
import { useUiStore } from '@/store/uiStore';
import type { ListViewModel } from '@/store/selectors';
import { STATUS_STYLES, cx } from '@/ui/tokens';
import { listPrefix } from '@/domain/taskKey';
import { IconButton } from '@/components/ui/primitives';
import { ChevronRight, Plus } from '@/ui/icons';
import { SortableTaskCard, TaskCardBody } from './TaskCard';
import { QuickAdd, type QuickAddHandle } from './QuickAdd';

const COLUMN_PREFIX = 'col:';
type Columns = Record<ID, ID[]>;

function Column({
  status,
  taskIds,
  tasks,
  users,
  vm,
  isOver,
  filtered,
  collapsed,
  onToggleCollapse,
  keyPrefix,
  onOpen,
}: {
  status: Status;
  taskIds: ID[];
  tasks: Record<ID, Task>;
  users: Record<ID, User>;
  vm: ListViewModel;
  isOver: boolean;
  filtered: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  keyPrefix: string;
  onOpen: (id: ID) => void;
}) {
  const { setNodeRef } = useDroppable({ id: COLUMN_PREFIX + status.id, data: { type: 'column' } });
  const styles = STATUS_STYLES[status.color];
  const quickAdd = useRef<QuickAddHandle>(null);
  const points = taskIds.reduce((sum, id) => sum + (tasks[id]?.points ?? 0), 0);

  if (collapsed) {
    // Jira-style collapsed column: a slim vertical strip that still accepts drops.
    return (
      <section
        ref={setNodeRef}
        aria-label={`${status.name} column (collapsed)`}
        className={cx(
          'flex w-10 shrink-0 cursor-pointer flex-col items-center gap-2 rounded-panel py-3 transition-colors',
          isOver ? 'bg-brand-50 ring-2 ring-inset ring-brand-300' : 'bg-column hover:bg-black/[0.06]',
        )}
        onClick={onToggleCollapse}
        title={`Expand ${status.name}`}
      >
        <ChevronRight size={14} className="text-ink-subtle" />
        <span className={cx('h-2 w-2 rounded-full', styles.dot)} />
        <span className="text-2xs font-semibold tabular-nums text-ink-muted">{taskIds.length}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted [writing-mode:vertical-rl]">{status.name}</span>
      </section>
    );
  }

  return (
    <section
      aria-label={`${status.name} column`}
      data-testid={`column-${status.name}`}
      className={cx(
        'flex max-h-full w-[85vw] max-w-[17rem] shrink-0 snap-start flex-col rounded-panel transition-colors sm:w-[17rem]',
        isOver ? 'bg-brand-50 ring-2 ring-inset ring-brand-300' : 'bg-column',
      )}
    >
      <span className={cx('h-1 rounded-t-panel', styles.bar)} aria-hidden />
      <header className="group/col flex items-center gap-2 py-2 pl-3 pr-1.5">
        <span className={cx('h-2 w-2 rounded-full', styles.dot)} />
        <h3 className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-ink-muted">{status.name}</h3>
        <span className="rounded-pill bg-black/5 px-1.5 text-2xs font-semibold tabular-nums text-ink-muted">{taskIds.length}</span>
        {points > 0 && (
          <span className="text-2xs tabular-nums text-ink-subtle" title="Story points in this column">
            {points} pts
          </span>
        )}
        <span className="ml-auto flex items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover/col:opacity-100">
          <IconButton label={`Add task to ${status.name}`} onClick={() => quickAdd.current?.open()}>
            <Plus size={14} />
          </IconButton>
          <IconButton label={`Collapse ${status.name}`} onClick={onToggleCollapse}>
            <ChevronRight size={14} className="rotate-180" />
          </IconButton>
        </span>
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
                taskKey={`${keyPrefix}-${t.number}`}
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
            {isOver ? 'Drop here' : filtered ? 'No matching tasks' : 'No tasks yet'}
          </div>
        )}
      </div>
      <div className="px-2 pb-2">
        <QuickAdd ref={quickAdd} listId={vm.list.id} statusId={status.id} statusName={status.name} />
      </div>
    </section>
  );
}

/**
 * Kanban board. During a drag we keep a local *preview* of column membership so cards shift
 * live across columns; on drop we commit a single `moveTask` to the store. If the store rejects
 * the move (e.g. permission revoked) the preview is discarded — i.e. the UI rolls back.
 */
export function BoardView({ vm, allColumns = vm.columns }: { vm: ListViewModel; allColumns?: ListViewModel['columns'] }) {
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
  const keyPrefix = listPrefix(vm.list.name);
  const [collapsedCols, setCollapsedCols] = useState<Set<ID>>(new Set());
  const toggleCollapse = (id: ID) =>
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
    // With a filter active some cards are hidden: anchor on the visible neighbour so the
    // index we commit is relative to the full column, not the filtered one.
    const pos = ids.indexOf(taskId);
    const full = (allColumns[to] ?? []).map((t) => t.id).filter((id) => id !== taskId);
    const next = ids[pos + 1];
    const prev = ids[pos - 1];
    const index = next ? full.indexOf(next) : prev ? full.indexOf(prev) + 1 : full.length;

    const statusChanged = to !== tasks[taskId]?.statusId;
    const move = () => useAppStore.getState().moveTask(taskId, { statusId: to, index });
    if (statusChanged) {
      // Column changes get an Undo toast; plain reorders stay silent.
      withUndo(`Moved to ${vm.statuses.find((s) => s.id === to)?.name ?? 'column'}`, move);
    } else {
      notify(move());
    }
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
      <div className="flex h-full snap-x snap-mandatory items-start gap-3 overflow-x-auto scroll-px-4 px-4 pb-6 pt-1 sm:snap-none lg:px-6" data-testid="board">
        {vm.statuses.map((status) => (
          <Column
            key={status.id}
            status={status}
            taskIds={columns[status.id] ?? []}
            tasks={tasks}
            users={users}
            vm={vm}
            isOver={activeId !== null && overColumn === status.id}
            collapsed={collapsedCols.has(status.id)}
            onToggleCollapse={() => toggleCollapse(status.id)}
            keyPrefix={keyPrefix}
            filtered={vm.tasks.length !== Object.values(allColumns).reduce((n, c) => n + c.length, 0)}
            onOpen={openTask}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 160, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
        {active ? (
          <div className="w-64">
            <TaskCardBody
              task={active}
              taskKey={`${keyPrefix}-${active.number}`}
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
