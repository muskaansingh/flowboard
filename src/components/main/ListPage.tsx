import { useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '@/store/appStore';
import { toast } from '@/store/toastStore';
import { UNASSIGNED, useUiStore, type DueFilter, type TaskFilter, type ViewMode } from '@/store/uiStore';
import { selectListView, useCurrentUser, useSelector, type ListViewModel } from '@/store/selectors';
import { visibleListIds } from '@/domain/tree';
import { useDialogStore } from '@/components/dialogs/dialogStore';
import { BoardView } from '@/components/board/BoardView';
import { ListView } from '@/components/list/ListView';
import { NewTaskDialog } from '@/components/task/NewTaskDialog';
import { Avatar, Button, EmptyState, Kbd, Skeleton, StatusDot, formatDue } from '@/components/ui/primitives';
import { PRIORITIES } from '@/domain/types';
import { canSeeContainer } from '@/domain/permissions';
import { toPlainText } from '@/domain/richText';
import { FilterDropdown } from './FilterDropdown';
import { SavedViews } from './SavedViews';
import { useShortcut } from '@/hooks/useShortcut';
import { Alert, Board, Flag, ListIcon, Lock, Plus, Rows, Search, Settings, Share, X } from '@/ui/icons';
import { PRIORITY_META, cx, focusRing } from '@/ui/tokens';

/** Narrows the view model to tasks matching the in-list filter. Columns keep their statuses. */
export const filterCount = (f: TaskFilter) =>
  (f.query.trim() ? 1 : 0) + (f.mine ? 1 : 0) + f.statusIds.length + f.assigneeIds.length + f.priorities.length + f.due.length + f.labels.length;

const DAY = 86_400_000;
const dayDiff = (iso: string, now: Date) => {
  const d = new Date(iso);
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / DAY);
};

/** Due-date buckets. "Overdue" and the date windows skip done tasks — finished work isn't late. */
function matchesDue(t: ListViewModel['tasks'][number], due: DueFilter[], done: boolean, now: Date) {
  if (due.length === 0) return true;
  return due.some((d) => {
    if (d === 'none') return !t.dueDate;
    if (!t.dueDate || done) return false;
    const diff = dayDiff(t.dueDate, now);
    return d === 'overdue' ? diff < 0 : d === 'today' ? diff === 0 : diff >= 0 && diff <= 7;
  });
}

/** Within a field values are OR-ed; across fields they're AND-ed (Jira's quick-filter semantics). */
export function filterListView(vm: ListViewModel, filter: TaskFilter, userId: string, now = new Date()): ListViewModel {
  const q = filter.query.trim().toLowerCase();
  if (filterCount(filter) === 0) return vm;
  const doneIds = new Set(vm.statuses.filter((s) => s.category === 'done').map((s) => s.id));
  const match = (t: ListViewModel['tasks'][number]) =>
    (!filter.mine || t.assigneeIds.includes(userId)) &&
    (!q || t.title.toLowerCase().includes(q) || toPlainText(t.description ?? '').toLowerCase().includes(q)) &&
    (filter.statusIds.length === 0 || filter.statusIds.includes(t.statusId)) &&
    (filter.priorities.length === 0 || filter.priorities.includes(t.priority)) &&
    (filter.labels.length === 0 || filter.labels.some((l) => t.labels.includes(l))) &&
    (filter.assigneeIds.length === 0 ||
      filter.assigneeIds.some((id) => (id === UNASSIGNED ? t.assigneeIds.length === 0 : t.assigneeIds.includes(id)))) &&
    matchesDue(t, filter.due, doneIds.has(t.statusId), now);
  return {
    ...vm,
    // A status filter also narrows the board to just those columns.
    statuses: filter.statusIds.length ? vm.statuses.filter((st) => filter.statusIds.includes(st.id)) : vm.statuses,
    tasks: vm.tasks.filter(match),
    columns: Object.fromEntries(Object.entries(vm.columns).map(([id, col]) => [id, col.filter(match)])),
  };
}

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'week', label: 'Due in next 7 days' },
  { value: 'none', label: 'No due date' },
];

function FilterBar({ vm, shown }: { vm: ListViewModel; shown: number }) {
  const filter = useUiStore((s) => s.filter);
  const setFilter = useUiStore((s) => s.setFilter);
  const clearFilter = useUiStore((s) => s.clearFilter);
  const users = useAppStore((s) => s.users);
  const state = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const total = vm.tasks.length;
  const active = filterCount(filter) > 0;

  // Option counts are taken from the whole list so you can see what each choice would match.
  const countBy = (pred: (t: ListViewModel['tasks'][number]) => boolean) => vm.tasks.filter(pred).length;
  const statusOptions = vm.statuses.map((st) => ({
    value: st.id,
    label: st.name,
    icon: <StatusDot status={st} />,
    count: countBy((t) => t.statusId === st.id),
  }));
  const people = Object.values(users)
    .filter((u) => canSeeContainer(state, u.id, vm.list.id))
    .sort((a, b) => (a.id === state.currentUserId ? -1 : b.id === state.currentUserId ? 1 : a.name.localeCompare(b.name)));
  const toggleAssignee = (id: string) =>
    setFilter({ assigneeIds: filter.assigneeIds.includes(id) ? filter.assigneeIds.filter((x) => x !== id) : [...filter.assigneeIds, id] });
  const labelOptions = [...new Set(vm.tasks.flatMap((t) => t.labels))].sort().map((l) => ({
    value: l,
    label: l,
    count: countBy((t) => t.labels.includes(l)),
  }));
  const assigneeOptions = [
    { value: UNASSIGNED, label: 'Unassigned', count: countBy((t) => t.assigneeIds.length === 0) },
    ...people
      .map((u) => ({
        value: u.id,
        label: u.id === state.currentUserId ? `${u.name} (me)` : u.name,
        icon: <Avatar user={u} size="xs" />,
        count: countBy((t) => t.assigneeIds.includes(u.id)),
      })),
  ];
  const priorityOptions = PRIORITIES.map((p) => ({
    value: p,
    label: PRIORITY_META[p].label,
    icon: <Flag size={13} className={PRIORITY_META[p].icon} />,
    count: countBy((t) => t.priority === p),
  }));
  useShortcut('f', () => inputRef.current?.focus());
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-3 lg:px-6" data-testid="filter-bar">
      <div className="relative w-full max-w-60 sm:w-60">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
        <input
          ref={inputRef}
          type="search"
          aria-label="Filter tasks in this list"
          placeholder="Filter tasks…"
          value={filter.query}
          onChange={(e) => setFilter({ query: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setFilter({ query: '' });
              e.currentTarget.blur();
            }
          }}
          className="h-8 w-full rounded-lg border-0 bg-surface pl-8 pr-8 text-xs text-ink ring-1 ring-inset ring-line placeholder:text-ink-subtle hover:ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand-500 [&::-webkit-search-cancel-button]:hidden"
        />
        {filter.query ? (
          <button
            type="button"
            aria-label="Clear filter text"
            onClick={() => setFilter({ query: '' })}
            className="absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-ink-subtle hover:bg-black/5 hover:text-ink"
          >
            <X size={12} />
          </button>
        ) : (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
            <Kbd>F</Kbd>
          </span>
        )}
      </div>
      <button
        type="button"
        aria-pressed={filter.mine}
        onClick={() => setFilter({ mine: !filter.mine })}
        className={cx(
          'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium ring-1 ring-inset transition-colors',
          filter.mine ? 'bg-brand-50 text-brand-700 ring-brand-300' : 'bg-surface text-ink-muted ring-line hover:text-ink hover:ring-line-strong',
          focusRing,
        )}
      >
        My tasks
      </button>
      {/* Jira's avatar quick-filter: click faces to show only their work. */}
      <div role="group" aria-label="Filter by person" className="flex items-center -space-x-1.5 pl-1">
        {people.slice(0, 6).map((u) => {
          const on = filter.assigneeIds.includes(u.id);
          return (
            <button
              key={u.id}
              type="button"
              aria-pressed={on}
              aria-label={`Show ${u.name}'s tasks`}
              title={u.name}
              onClick={() => toggleAssignee(u.id)}
              className={cx(
                'relative rounded-full ring-2 transition-transform hover:z-10 hover:-translate-y-0.5 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-brand-500',
                on ? 'z-10 ring-brand-500' : 'ring-surface',
              )}
            >
              <Avatar user={u} size="md" />
            </button>
          );
        })}
      </div>
      <span className="mx-0.5 hidden h-5 w-px bg-line sm:block" aria-hidden />
      <FilterDropdown label="Status" options={statusOptions} value={filter.statusIds} onChange={(statusIds) => setFilter({ statusIds })} />
      <FilterDropdown label="Assignee" options={assigneeOptions} value={filter.assigneeIds} onChange={(assigneeIds) => setFilter({ assigneeIds })} />
      <FilterDropdown label="Priority" options={priorityOptions} value={filter.priorities} onChange={(priorities) => setFilter({ priorities })} />
      {labelOptions.length > 0 && (
        <FilterDropdown label="Labels" options={labelOptions} value={filter.labels} onChange={(labels) => setFilter({ labels })} />
      )}
      <FilterDropdown label="Due date" options={DUE_OPTIONS} value={filter.due} onChange={(due) => setFilter({ due })} />
      <SavedViews canSave={active} />
      {active && (
        <>
          <span className="text-xs text-ink-muted" aria-live="polite">
            Showing {shown} of {total}
          </span>
          <Button size="sm" variant="ghost" onClick={clearFilter}>
            Clear all
          </Button>
        </>
      )}
    </div>
  );
}

function ViewToggle() {
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  useShortcut('b', () => setView('board'));
  useShortcut('l', () => setView('list'));
  const options: [ViewMode, string, React.ReactNode][] = [
    ['board', 'Board (B)', <Board key="b" size={14} />],
    ['list', 'List (L)', <Rows key="r" size={14} />],
  ];
  return (
    <div role="tablist" aria-label="View" className="inline-flex rounded-lg bg-black/5 p-0.5">
      {options.map(([value, label, icon]) => (
        <button
          key={value}
          role="tab"
          type="button"
          aria-selected={view === value}
          onClick={() => setView(value)}
          title={label}
          className={cx(
            'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all',
            view === value ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink',
            focusRing,
          )}
        >
          {icon}
          {label.replace(/ \(.\)$/, '')}
        </button>
      ))}
    </div>
  );
}

function ListHeader({ vm, onNewTask }: { vm: ListViewModel; onNewTask: () => void }) {
  const openDialog = useDialogStore((s) => s.open);
  const done = vm.tasks.filter((t) => vm.statuses.find((s) => s.id === t.statusId)?.category === 'done').length;
  const pct = vm.tasks.length ? Math.round((done / vm.tasks.length) * 100) : 0;
  const doneIds = new Set(vm.statuses.filter((s) => s.category === 'done').map((s) => s.id));
  const overdue = vm.tasks.filter((t) => t.dueDate && !doneIds.has(t.statusId) && formatDue(t.dueDate).tone === 'overdue').length;
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3 px-4 pb-5 pt-6 lg:px-6">
      <div className="min-w-[12rem] flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-xl font-semibold tracking-tight text-ink">{vm.list.name}</h1>
          {vm.list.visibility === 'private' && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-amber-50 px-2 py-0.5 text-2xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
              <Lock size={11} /> Private
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3 whitespace-nowrap text-xs text-ink-muted">
          <span>
            {vm.tasks.length} task{vm.tasks.length === 1 ? '' : 's'}
          </span>
          {vm.tasks.length > 0 && (
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-line">
                <span className={cx('block h-full rounded-full bg-emerald-500', pctWidth(pct))} />
              </span>
              <span title={`${done} of ${vm.tasks.length} tasks done`}>{pct}% done</span>
            </span>
          )}
          {overdue > 0 && (
            <span className="rounded-pill bg-rose-50 px-2 py-0.5 font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
              {overdue} overdue
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ViewToggle />
        {vm.canManage && (
          <>
            <Button size="sm" variant="ghost" icon={<Share size={13} />} onClick={() => openDialog({ kind: 'sharing', id: vm.list.id })}>
              Share
            </Button>
            <Button size="sm" variant="ghost" icon={<Settings size={13} />} onClick={() => openDialog({ kind: 'statuses', listId: vm.list.id })}>
              Statuses
            </Button>
          </>
        )}
        <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={onNewTask} title="New task (N)">
          New task
        </Button>
      </div>
    </div>
  );
}

/** Progress bar width in 10% steps — keeps us inside Tailwind utilities (no inline style). */
function pctWidth(pct: number) {
  const steps = ['w-0', 'w-[10%]', 'w-[20%]', 'w-[30%]', 'w-[40%]', 'w-[50%]', 'w-[60%]', 'w-[70%]', 'w-[80%]', 'w-[90%]', 'w-full'];
  return steps[Math.round(pct / 10)] ?? 'w-0';
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3 px-4 pt-1 lg:px-6" role="status" aria-label="Loading board">
      {[3, 2, 4, 1].map((n, i) => (
        <div key={i} className="w-[17rem] shrink-0 space-y-2 rounded-panel bg-column p-2">
          <Skeleton className="m-1 h-3 w-24" />
          {Array.from({ length: n }).map((_, j) => (
            <div key={j} className="space-y-2.5 rounded-card bg-surface p-3 shadow-card ring-1 ring-line">
              <Skeleton className={j % 2 ? 'h-3.5 w-3/4' : 'h-3.5 w-full'} />
              <div className="flex gap-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="ml-auto h-6 w-6 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="px-4 lg:px-6" role="status" aria-label="Loading list">
      <div className="space-y-px overflow-hidden rounded-panel bg-surface ring-1 ring-line">
        <Skeleton className="h-9 rounded-none" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-4 py-3">
            <Skeleton className={i % 2 ? 'h-3.5 w-1/3' : 'h-3.5 w-1/2'} />
            <Skeleton className="ml-auto h-5 w-20 rounded-pill" />
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="space-y-2 px-6 pb-4 pt-5">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

function Welcome() {
  const user = useCurrentUser();
  const state = useAppStore();
  const lists = [...visibleListIds(state, state.currentUserId)].map((id) => state.containers[id]!);
  const selectList = useUiStore((s) => s.selectList);
  return (
    <EmptyState
      icon={<ListIcon size={22} />}
      title={`Welcome, ${user.name.split(' ')[0]}`}
      description={lists.length ? 'Pick a list from the sidebar to see its board.' : 'No lists have been shared with you yet. Ask an admin for access.'}
      action={
        lists.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {lists.map((l) => (
              <Button key={l.id} size="sm" onClick={() => selectList(l.id)}>
                {l.name}
              </Button>
            ))}
          </div>
        )
      }
    />
  );
}

export function ListPage() {
  const boot = useAppStore((s) => s.boot);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const listId = useUiStore((s) => s.selectedListId);
  const listLoading = useUiStore((s) => s.listLoading);
  const view = useUiStore((s) => s.view);
  const result = useSelector((s) => (listId ? selectListView(s, listId) : null), [listId]);
  const newTaskOpen = useUiStore((s) => s.newTaskOpen);
  const setNewTaskOpen = useUiStore((s) => s.setNewTaskOpen);
  const filter = useUiStore((s) => s.filter);
  const fullVm = result?.data;
  const shownVm = useMemo(() => fullVm && filterListView(fullVm, filter, currentUserId), [fullVm, filter, currentUserId]);
  useShortcut('n', () => setNewTaskOpen(true), !!fullVm);

  // Keep the browser tab title in sync with the open list.
  const listName = fullVm?.list.name;
  useEffect(() => {
    document.title = listName ? `${listName} · Flowboard` : 'Flowboard';
  }, [listName]);

  // Surface 403s as a toast once per (user, list) — the panel below explains it in place.
  const lastDenied = useRef<string | null>(null);
  useEffect(() => {
    const key = `${currentUserId}:${listId}`;
    if (result?.error?.code === 'FORBIDDEN' && lastDenied.current !== key) {
      lastDenied.current = key;
      toast.error(result.error);
    }
    if (!result?.error) lastDenied.current = null;
  }, [result, currentUserId, listId]);

  if (boot === 'loading' || listLoading) {
    return (
      <div className="flex h-full flex-col">
        <HeaderSkeleton />
        {view === 'board' ? <BoardSkeleton /> : <ListSkeleton />}
      </div>
    );
  }

  if (!listId || !result) return <Welcome />;

  if (result.error) {
    const forbidden = result.error.code === 'FORBIDDEN';
    return (
      <div className="flex h-full items-center justify-center" data-testid="list-error">
        <EmptyState
          icon={forbidden ? <Lock size={22} /> : <Alert size={22} />}
          title={forbidden ? 'You don’t have access to this list' : 'This list is unavailable'}
          description={
            <>
              {forbidden
                ? 'It’s private or access was revoked. Ask a workspace admin to share it with you, or switch user from the top bar.'
                : result.error.message}
              <span className="mt-2 block font-mono text-2xs text-ink-subtle">
                {forbidden ? '403' : '404'} · {result.error.code}
              </span>
            </>
          }
          action={<Button onClick={() => useUiStore.getState().selectList(null)}>Go home</Button>}
        />
      </div>
    );
  }

  const vm = result.data;
  const shown = shownVm ?? vm;
  const empty = vm.tasks.length === 0;
  const noMatches = !empty && shown.tasks.length === 0;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ListHeader vm={vm} onNewTask={() => setNewTaskOpen(true)} />
      {!empty && <FilterBar vm={vm} shown={shown.tasks.length} />}
      <div className="min-h-0 flex-1">
        {view === 'list' && noMatches ? (
          <div className="px-4 lg:px-6">
            <div className="rounded-panel bg-surface ring-1 ring-line">
              <EmptyState
                icon={<Search size={20} />}
                title="No tasks match your filter"
                description="Try removing a filter or two."
                action={<Button onClick={() => useUiStore.getState().clearFilter()}>Clear filter</Button>}
              />
            </div>
          </div>
        ) : view === 'list' && empty ? (
          <div className="px-4 lg:px-6">
            <div className="rounded-panel bg-surface ring-1 ring-line">
              <EmptyState
                icon={<Rows size={20} />}
                title="No tasks in this list yet"
                description="Create the first task to get things moving."
                action={
                  <Button variant="primary" icon={<Plus size={14} />} onClick={() => setNewTaskOpen(true)}>
                    New task
                  </Button>
                }
              />
            </div>
          </div>
        ) : view === 'board' ? (
          <BoardView vm={shown} allColumns={vm.columns} />
        ) : (
          <ListView vm={shown} />
        )}
      </div>
      <NewTaskDialog vm={vm} open={newTaskOpen} onClose={() => setNewTaskOpen(false)} />
    </div>
  );
}
