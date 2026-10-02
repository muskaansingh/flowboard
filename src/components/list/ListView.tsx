import { useMemo } from 'react';
import type { Task } from '@/domain/types';
import { useAppStore } from '@/store/appStore';
import { useUiStore, type SortKey, type SortState } from '@/store/uiStore';
import type { ListViewModel } from '@/store/selectors';
import { AvatarStack, DueDate, PriorityBadge, StatusPill } from '@/components/ui/primitives';
import { ArrowDown, ArrowUp, ChevronUpDown, Subtasks } from '@/ui/icons';
import { PRIORITY_META, cx } from '@/ui/tokens';

/** Pure sort used by the list view (exported for tests). Ties fall back to board order. */
export function sortTasks(tasks: Task[], sort: SortState, statusOrder: Map<string, number>): Task[] {
  const boardOrder = (a: Task, b: Task) =>
    (statusOrder.get(a.statusId) ?? 0) - (statusOrder.get(b.statusId) ?? 0) || a.position - b.position;
  if (sort.key === 'manual') return [...tasks].sort(boardOrder);
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...tasks].sort((a, b) => {
    let cmp = 0;
    if (sort.key === 'priority') cmp = PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank;
    if (sort.key === 'dueDate') {
      // Tasks without a due date always sink to the bottom, regardless of direction.
      if (!a.dueDate || !b.dueDate) return a.dueDate ? -1 : b.dueDate ? 1 : boardOrder(a, b);
      cmp = Date.parse(a.dueDate) - Date.parse(b.dueDate);
    }
    return cmp * dir || boardOrder(a, b);
  });
}

function SortHeader({ label, sortKey, className }: { label: string; sortKey: Exclude<SortKey, 'manual'>; className?: string }) {
  const sort = useUiStore((s) => s.sort);
  const setSort = useUiStore((s) => s.setSort);
  const activeKey = sort.key === sortKey;
  const next = (): SortState =>
    !activeKey ? { key: sortKey, dir: 'asc' } : sort.dir === 'asc' ? { key: sortKey, dir: 'desc' } : { key: 'manual', dir: 'asc' };
  const label2 = sortKey === 'priority' ? (sort.dir === 'asc' ? 'highest first' : 'lowest first') : sort.dir === 'asc' ? 'soonest first' : 'latest first';
  return (
    <th scope="col" aria-sort={activeKey ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={className}>
      <button
        type="button"
        onClick={() => setSort(next())}
        className={cx(
          '-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase tracking-wide transition-colors hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          activeKey && 'text-brand-700',
        )}
        title={activeKey ? `Sorted ${label2}` : `Sort by ${label.toLowerCase()}`}
      >
        {label}
        {activeKey ? sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ChevronUpDown size={12} className="opacity-50" />}
      </button>
    </th>
  );
}

export function ListView({ vm }: { vm: ListViewModel }) {
  const users = useAppStore((s) => s.users);
  const sort = useUiStore((s) => s.sort);
  const openTask = useUiStore((s) => s.openTask);
  const statusById = useMemo(() => new Map(vm.statuses.map((s) => [s.id, s])), [vm.statuses]);
  const statusOrder = useMemo(() => new Map(vm.statuses.map((s, i) => [s.id, i])), [vm.statuses]);
  const rows = useMemo(() => sortTasks(vm.tasks, sort, statusOrder), [vm.tasks, sort, statusOrder]);

  return (
    <div className="h-full overflow-auto px-6 pb-6">
      <div className="overflow-hidden rounded-panel bg-surface shadow-card ring-1 ring-line">
        <table className="w-full table-fixed text-left text-sm" data-testid="list-table">
          <thead className="border-b border-line bg-canvas text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
            <tr className="[&>th]:px-4 [&>th]:py-2.5">
              <th scope="col" className="w-auto">
                Title
              </th>
              <th scope="col" className="w-36">
                Status
              </th>
              <th scope="col" className="w-32">
                Assignees
              </th>
              <SortHeader label="Priority" sortKey="priority" className="w-32" />
              <SortHeader label="Due date" sortKey="dueDate" className="w-32" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((t) => {
              const status = statusById.get(t.statusId);
              const done = status?.category === 'done';
              const sub = vm.subtaskCounts[t.id];
              return (
                <tr
                  key={t.id}
                  tabIndex={0}
                  onClick={() => openTask(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openTask(t.id);
                    }
                  }}
                  aria-label={`Open ${t.title}`}
                  data-testid="list-row"
                  className="cursor-pointer transition-colors hover:bg-brand-50/50 focus-visible:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 active:bg-brand-50 [&>td]:px-4 [&>td]:py-2.5"
                >
                  <td className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      {t.priority === 'urgent' && <span className="h-4 w-[3px] shrink-0 rounded bg-rose-500" aria-hidden />}
                      <span className={cx('truncate font-medium text-ink', done && 'text-ink-muted line-through decoration-ink-subtle/60')}>
                        {t.title}
                      </span>
                      {sub && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-2xs text-ink-subtle">
                          <Subtasks size={12} />
                          {sub.done}/{sub.total}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{status && <StatusPill status={status} />}</td>
                  <td>
                    {t.assigneeIds.length ? (
                      <AvatarStack users={t.assigneeIds.map((id) => users[id]!).filter(Boolean)} />
                    ) : (
                      <span className="text-xs text-ink-subtle">—</span>
                    )}
                  </td>
                  <td>
                    <PriorityBadge priority={t.priority} />
                  </td>
                  <td>{t.dueDate ? <DueDate iso={t.dueDate} done={done} /> : <span className="text-xs text-ink-subtle">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
