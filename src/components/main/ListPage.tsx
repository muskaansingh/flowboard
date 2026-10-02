import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { toast } from '@/store/toastStore';
import { useUiStore, type ViewMode } from '@/store/uiStore';
import { selectListView, useCurrentUser, useSelector, type ListViewModel } from '@/store/selectors';
import { visibleListIds } from '@/domain/tree';
import { useDialogStore } from '@/components/dialogs/dialogStore';
import { BoardView } from '@/components/board/BoardView';
import { ListView } from '@/components/list/ListView';
import { NewTaskDialog } from '@/components/task/NewTaskDialog';
import { Button, EmptyState, Skeleton } from '@/components/ui/primitives';
import { Alert, Board, ListIcon, Lock, Plus, Rows, Settings, Share } from '@/ui/icons';
import { cx, focusRing } from '@/ui/tokens';

function ViewToggle() {
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  const options: [ViewMode, string, React.ReactNode][] = [
    ['board', 'Board', <Board key="b" size={14} />],
    ['list', 'List', <Rows key="r" size={14} />],
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
          className={cx(
            'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all',
            view === value ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink',
            focusRing,
          )}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
}

function ListHeader({ vm, onNewTask }: { vm: ListViewModel; onNewTask: () => void }) {
  const openDialog = useDialogStore((s) => s.open);
  const done = vm.tasks.filter((t) => vm.statuses.find((s) => s.id === t.statusId)?.category === 'done').length;
  const pct = vm.tasks.length ? Math.round((done / vm.tasks.length) * 100) : 0;
  return (
    <div className="flex flex-wrap items-end gap-4 px-6 pb-4 pt-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-xl font-semibold tracking-tight text-ink">{vm.list.name}</h1>
          {vm.list.visibility === 'private' && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-amber-50 px-2 py-0.5 text-2xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
              <Lock size={11} /> Private
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-ink-muted">
          <span>
            {vm.tasks.length} task{vm.tasks.length === 1 ? '' : 's'}
          </span>
          {vm.tasks.length > 0 && (
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-line">
                <span className={cx('block h-full rounded-full bg-emerald-500', pctWidth(pct))} />
              </span>
              {pct}% done
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
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
        <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={onNewTask}>
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
    <div className="flex gap-3 px-6 pt-1" role="status" aria-label="Loading board">
      {[3, 2, 4, 1].map((n, i) => (
        <div key={i} className="w-[17rem] shrink-0 space-y-2 rounded-panel bg-black/[0.03] p-2">
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
    <div className="px-6" role="status" aria-label="Loading list">
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
  const [newTaskOpen, setNewTaskOpen] = useState(false);

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
  const empty = vm.tasks.length === 0;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ListHeader vm={vm} onNewTask={() => setNewTaskOpen(true)} />
      <div className="min-h-0 flex-1">
        {view === 'list' && empty ? (
          <div className="px-6">
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
          <BoardView vm={vm} />
        ) : (
          <ListView vm={vm} />
        )}
      </div>
      <NewTaskDialog vm={vm} open={newTaskOpen} onClose={() => setNewTaskOpen(false)} />
    </div>
  );
}
