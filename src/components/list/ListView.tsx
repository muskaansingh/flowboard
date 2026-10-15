import { useMemo, useState, type ReactNode } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { PRIORITIES, type ID, type Priority, type Task, type User } from '@/domain/types';
import { ok, type Result } from '@/domain/result';
import { canSeeContainer } from '@/domain/permissions';
import { listPrefix } from '@/domain/taskKey';
import { notify } from '@/store/toastStore';
import { useAppStore } from '@/store/appStore';
import { UNASSIGNED, useUiStore, type GroupBy, type SortKey, type SortState } from '@/store/uiStore';
import type { ListViewModel } from '@/store/selectors';
import { Avatar, AvatarStack, Button, DueDate, LabelChip, PriorityBadge, Select, StatusDot, StatusPill, TaskTypeIcon } from '@/components/ui/primitives';
import { PriorityMenu } from '@/components/board/PriorityMenu';
import { InlineStatusMenu } from '@/components/task/fields';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ChevronUpDown, Plus, Subtasks, Trash, X } from '@/ui/icons';
import { PRIORITY_META, cx } from '@/ui/tokens';
import { DoneToggle, withUndo } from '@/components/task/taskActions';

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

type Row = Task;
interface Group {
  id: string;
  label: ReactNode;
  rows: Row[];
}

/** Splits sorted rows into collapsible sections (Jira/ClickUp "group by"). Empty groups are kept for statuses. */
function groupRows(rows: Row[], groupBy: GroupBy, vm: ListViewModel, users: Record<ID, User>): Group[] {
  if (groupBy === 'none') return [{ id: 'all', label: null, rows }];
  if (groupBy === 'status') {
    return vm.statuses.map((st) => ({ id: st.id, label: <StatusPill status={st} />, rows: rows.filter((r) => r.statusId === st.id) }));
  }
  if (groupBy === 'priority') {
    return PRIORITIES.map((p) => ({ id: p, label: <PriorityBadge priority={p} />, rows: rows.filter((r) => r.priority === p) })).filter((g) => g.rows.length);
  }
  const byUser = new Map<string, Row[]>();
  for (const r of rows) for (const id of r.assigneeIds.length ? r.assigneeIds : [UNASSIGNED]) byUser.set(id, [...(byUser.get(id) ?? []), r]);
  return [...byUser.entries()]
    .sort(([a], [b]) => (a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : (users[a]?.name ?? '').localeCompare(users[b]?.name ?? '')))
    .map(([id, rs]) => ({
      id,
      label:
        id === UNASSIGNED ? (
          <span className="text-xs font-semibold text-ink-muted">Unassigned</span>
        ) : (
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink">
            {users[id] && <Avatar user={users[id]!} size="xs" />}
            {users[id]?.name ?? 'Unknown'}
          </span>
        ),
      rows: rs,
    }));
}

/** Runs one command per selected task under a single Undo. Stops at the first failure. */
function bulk(title: string, ids: ID[], run: (id: ID) => Result<unknown>) {
  withUndo(title, () => {
    for (const id of ids) {
      const res = run(id);
      if (res.error) return res;
    }
    return ok(true);
  });
}

export function ListView({ vm }: { vm: ListViewModel }) {
  const users = useAppStore((s) => s.users);
  const containers = useAppStore((s) => s.containers);
  const sort = useUiStore((s) => s.sort);
  const groupBy = useUiStore((s) => s.groupBy);
  const setGroupBy = useUiStore((s) => s.setGroupBy);
  const openTask = useUiStore((s) => s.openTask);
  const statusById = useMemo(() => new Map(vm.statuses.map((s) => [s.id, s])), [vm.statuses]);
  const statusOrder = useMemo(() => new Map(vm.statuses.map((s, i) => [s.id, i])), [vm.statuses]);
  const rows = useMemo(() => sortTasks(vm.tasks, sort, statusOrder), [vm.tasks, sort, statusOrder]);
  const groups = useMemo(() => groupRows(rows, groupBy, vm, users), [rows, groupBy, vm, users]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<ID>>(new Set());
  const prefix = listPrefix(vm.list.name);
  const assignable = useMemo(
    () => Object.values(users).filter((u) => canSeeContainer(useAppStore.getState(), u.id, vm.list.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, vm.list.id, containers],
  );

  // Drop selections for tasks that disappeared (deleted / filtered out).
  const visibleIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const sel = [...selected].filter((id) => visibleIds.has(id));
  const allSelected = rows.length > 0 && sel.length === rows.length;
  const toggle = (id: ID) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const store = () => useAppStore.getState();
  const n = sel.length;
  const plural = `${n} task${n === 1 ? '' : 's'}`;

  return (
    <div className="flex h-full flex-col px-4 pb-6 lg:px-6">
      {/* Toolbar: bulk actions when rows are selected, otherwise grouping */}
      <div className="mb-2 flex min-h-9 flex-wrap items-center gap-2" data-testid="list-toolbar">
        {n > 0 ? (
          <div role="toolbar" aria-label="Bulk actions" className="flex flex-wrap items-center gap-1.5 rounded-lg bg-ink px-2 py-1 text-xs text-ink-inverse shadow-lift">
            <span className="px-1.5 font-semibold">{n} selected</span>
            <BulkMenu label="Status" options={vm.statuses.map((st) => ({ id: st.id, label: st.name, icon: <StatusDot status={st} /> }))} onPick={(id) => bulk(`Updated ${plural}`, sel, (t) => store().updateTask(t, { statusId: id }))} />
            <BulkMenu label="Priority" options={PRIORITIES.map((p) => ({ id: p, label: PRIORITY_META[p].label }))} onPick={(p) => bulk(`Updated ${plural}`, sel, (t) => store().updateTask(t, { priority: p as Priority }))} />
            <BulkMenu
              label="Assign"
              options={[{ id: UNASSIGNED, label: 'Unassign everyone' }, ...assignable.map((u) => ({ id: u.id, label: u.name, icon: <Avatar user={u} size="xs" /> }))]}
              onPick={(uid) =>
                bulk(`Updated ${plural}`, sel, (t) => {
                  const task = store().tasks[t]!;
                  return store().updateTask(t, { assigneeIds: uid === UNASSIGNED ? [] : [...new Set([...task.assigneeIds, uid])] });
                })
              }
            />
            <button
              type="button"
              onClick={() => {
                bulk(`Deleted ${plural}`, sel, (t) => (store().tasks[t] ? store().deleteTask(t) : ok(true)));
                setSelected(new Set());
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 font-medium text-rose-200 hover:bg-white/10 hover:text-white"
            >
              <Trash size={13} /> Delete
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="inline-flex h-7 items-center rounded-md px-2 hover:bg-white/10" aria-label="Clear selection">
              <X size={13} />
            </button>
          </div>
        ) : (
          <span className="text-xs text-ink-subtle">Tip: tick rows to change many tasks at once.</span>
        )}
        <label className="ml-auto flex items-center gap-2 text-xs text-ink-muted">
          Group by
          <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className="h-8 py-1 text-xs" aria-label="Group by">
            <option value="none">None</option>
            <option value="status">Status</option>
            <option value="assignee">Assignee</option>
            <option value="priority">Priority</option>
          </Select>
        </label>
      </div>

      <div className="min-h-0 overflow-auto rounded-panel bg-surface shadow-card ring-1 ring-line">
        <table className="w-full table-fixed text-left text-sm" data-testid="list-table">
          <thead className="sticky top-0 z-10 border-b border-line bg-canvas text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
            <tr className="[&>th]:px-3 [&>th]:py-2.5">
              <th scope="col" className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all tasks"
                  checked={allSelected}
                  ref={(el) => el && (el.indeterminate = n > 0 && !allSelected)}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="h-3.5 w-3.5 rounded accent-brand-600"
                />
              </th>
              <th scope="col" className="w-24">
                Key
              </th>
              <th scope="col" className="w-auto">
                Title
              </th>
              <th scope="col" className="w-36">
                Status
              </th>
              <th scope="col" className="hidden w-28 md:table-cell">
                Assignees
              </th>
              <SortHeader label="Priority" sortKey="priority" className="hidden w-28 sm:table-cell" />
              <th scope="col" className="hidden w-16 text-right lg:table-cell" title="Story points">
                Pts
              </th>
              <SortHeader label="Due date" sortKey="dueDate" className="w-28" />
            </tr>
          </thead>
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.id);
            return (
              <tbody key={g.id} className="divide-y divide-line border-b border-line last:border-b-0">
                {groupBy !== 'none' && (
                  <tr className="bg-canvas/70">
                    <td colSpan={8} className="px-3 py-1.5">
                      <button
                        type="button"
                        aria-expanded={!isCollapsed}
                        onClick={() =>
                          setCollapsed((prev) => {
                            const next = new Set(prev);
                            if (next.has(g.id)) next.delete(g.id);
                            else next.add(g.id);
                            return next;
                          })
                        }
                        className="flex items-center gap-2 rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <ChevronRight size={13} className={cx('text-ink-subtle transition-transform', !isCollapsed && 'rotate-90')} />
                        {g.label}
                        <span className="rounded-pill bg-black/5 px-1.5 text-2xs font-semibold tabular-nums text-ink-muted">{g.rows.length}</span>
                      </button>
                    </td>
                  </tr>
                )}
                {!isCollapsed &&
                  g.rows.map((t) => {
                    const status = statusById.get(t.statusId);
                    const done = status?.category === 'done';
                    const sub = vm.subtaskCounts[t.id];
                    const isSel = selected.has(t.id);
                    const key = `${prefix}-${t.number}`;
                    return (
                      <tr
                        key={t.id}
                        tabIndex={0}
                        onClick={() => openTask(t.id)}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openTask(t.id);
                          }
                        }}
                        aria-label={`Open ${key} ${t.title}`}
                        aria-selected={isSel}
                        data-testid="list-row"
                        className={cx(
                          'group cursor-pointer transition-colors focus-visible:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 [&>td]:px-3 [&>td]:py-2',
                          isSel ? 'bg-brand-50/70' : 'hover:bg-canvas',
                        )}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${key}`}
                            checked={isSel}
                            onChange={() => toggle(t.id)}
                            className="h-3.5 w-3.5 rounded accent-brand-600"
                          />
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                            <TaskTypeIcon type={t.type} />
                            <span className={cx(done && 'line-through')}>{key}</span>
                          </span>
                        </td>
                        <td className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <DoneToggle taskId={t.id} title={t.title} done={done} />
                            <span className={cx('truncate font-medium text-ink', done && 'text-ink-muted line-through decoration-ink-subtle/60')}>
                              {t.title}
                            </span>
                            {t.labels.slice(0, 2).map((l) => (
                              <span key={l} className="hidden shrink-0 xl:inline-flex">
                                <LabelChip label={l} />
                              </span>
                            ))}
                            {sub && (
                              <span className="inline-flex shrink-0 items-center gap-1 text-2xs text-ink-subtle">
                                <Subtasks size={12} />
                                {sub.done}/{sub.total}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <InlineStatusMenu
                            statuses={vm.statuses}
                            value={t.statusId}
                            onChange={(statusId) => notify(store().updateTask(t.id, { statusId }))}
                          />
                        </td>
                        <td className="hidden md:table-cell">
                          {t.assigneeIds.length ? (
                            <AvatarStack users={t.assigneeIds.map((id) => users[id]!).filter(Boolean)} />
                          ) : (
                            <span className="text-xs text-ink-subtle">—</span>
                          )}
                        </td>
                        <td className="hidden sm:table-cell">
                          <PriorityMenu taskId={t.id} priority={t.priority} />
                          {t.priority === 'none' && <span className="text-xs text-ink-subtle group-hover:hidden">—</span>}
                        </td>
                        <td className="hidden text-right text-xs tabular-nums text-ink-muted lg:table-cell">{t.points ?? '—'}</td>
                        <td>{t.dueDate ? <DueDate iso={t.dueDate} done={done} /> : <span className="text-xs text-ink-subtle">—</span>}</td>
                      </tr>
                    );
                  })}
              </tbody>
            );
          })}
        </table>
        <InlineCreate listId={vm.list.id} />
      </div>
    </div>
  );
}

function BulkMenu({ label, options, onPick }: { label: string; options: { id: string; label: string; icon?: ReactNode }[]; onPick: (id: string) => void }) {
  return (
    <Menu>
      <MenuButton className="inline-flex h-7 items-center gap-1 rounded-md px-2 font-medium hover:bg-white/10 data-[open]:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
        {label} <ChevronDown size={12} />
      </MenuButton>
      <MenuItems anchor="bottom start" className="z-50 min-w-44 rounded-card bg-surface p-1 text-ink shadow-pop ring-1 ring-black/5 focus:outline-none [--anchor-gap:4px]">
        {options.map((o) => (
          <MenuItem key={o.id}>
            <button type="button" onClick={() => onPick(o.id)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm data-[focus]:bg-canvas">
              {o.icon}
              {o.label}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

/** "+ Create task" row at the bottom of the table — type a title, Enter to add (keeps focus for the next one). */
function InlineCreate({ listId }: { listId: ID }) {
  const [title, setTitle] = useState('');
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 border-t border-line px-4 py-2.5 text-left text-xs font-medium text-ink-subtle hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
      >
        <Plus size={14} /> Create task
      </button>
    );
  }
  return (
    <form
      className="flex items-center gap-2 border-t border-line px-4 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (notify(useAppStore.getState().createTask(listId, { title }))) setTitle('');
      }}
    >
      <Plus size={14} className="text-ink-subtle" />
      <input
        autoFocus
        aria-label="New task title"
        placeholder="What needs to be done? (Enter to add, Esc to close)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setTitle('');
            setOpen(false);
          }
        }}
        onBlur={() => !title.trim() && setOpen(false)}
        className="h-8 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-0"
      />
      <Button size="sm" variant="primary" type="submit" disabled={!title.trim()}>
        Add
      </Button>
    </form>
  );
}
