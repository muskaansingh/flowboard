import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useEffect, useRef } from 'react';
import { PRIORITIES } from '@/domain/types';
import { useAppStore } from '@/store/appStore';
import { notify } from '@/store/toastStore';
import { useUiStore } from '@/store/uiStore';
import { selectListView, selectTaskDetail, useSelector } from '@/store/selectors';
import { filterListView } from '@/components/main/ListPage';
import { sortTasks } from '@/components/list/ListView';
import { toggleTaskDone } from './taskActions';
import { Button, EmptyState, IconButton } from '@/components/ui/primitives';
import { Lock, X } from '@/ui/icons';
import { TaskDetail, type TaskNav } from './TaskDetail';

/**
 * Right-hand task drawer. Headless UI's Dialog gives us: focus trap, focus restore to the card
 * or row that opened it, Escape-to-close and overlay-click-to-close.
 */
export function TaskDrawer() {
  const taskId = useUiStore((s) => s.drawerTaskId);
  const close = useUiStore((s) => s.closeTask);
  const detail = useSelector((s) => (taskId ? selectTaskDetail(s, taskId) : null), [taskId]);
  const listId = useUiStore((s) => s.selectedListId);
  const view = useUiStore((s) => s.view);
  const sort = useUiStore((s) => s.sort);
  const filter = useUiStore((s) => s.filter);
  const currentUserId = useAppStore((s) => s.currentUserId);

  // Prev/next follow exactly what's on screen: same filter, and list-view sort when in list view.
  const nav = useSelector(
    (s): TaskNav | undefined => {
      if (!taskId || !listId) return undefined;
      const res = selectListView(s, listId);
      if (res.error) return undefined;
      const vm = filterListView(res.data, filter, currentUserId);
      const order =
        view === 'list'
          ? sortTasks(vm.tasks, sort, new Map(vm.statuses.map((st, i) => [st.id, i])))
          : vm.statuses.flatMap((st) => vm.columns[st.id] ?? []);
      const index = order.findIndex((t) => t.id === taskId);
      if (index < 0) return undefined;
      return { index, total: order.length, prev: order[index - 1]?.id, next: order[index + 1]?.id };
    },
    [taskId, listId, view, sort, filter, currentUserId],
  );

  /**
   * Single-key shortcuts while the drawer is open and focus isn't in a text field. Bound on
   * window, not the panel: J/K remount the detail and focus can briefly land outside it.
   */
  const onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (!taskId || e.metaKey || e.ctrlKey || e.altKey || e.repeat || target.closest?.('input, textarea, select, [contenteditable="true"], [role="listbox"]')) return;
    const task = useAppStore.getState().tasks[taskId];
    const key = e.key.toLowerCase();
    if (key === 'j' && nav?.next) useUiStore.getState().openTask(nav.next);
    else if (key === 'k' && nav?.prev) useUiStore.getState().openTask(nav.prev);
    else if (key === 'c') toggleTaskDone(taskId);
    else if (key === 'm' && task && !task.assigneeIds.includes(currentUserId))
      notify(useAppStore.getState().updateTask(taskId, { assigneeIds: [...task.assigneeIds, currentUserId] }), 'Assigned to you');
    else if (/^[1-5]$/.test(key)) notify(useAppStore.getState().updateTask(taskId, { priority: PRIORITIES[Number(key) - 1]! }));
    else return;
    e.preventDefault();
  };
  const handler = useRef(onKeyDown);
  handler.current = onKeyDown;
  useEffect(() => {
    if (!taskId) return;
    const listener = (e: KeyboardEvent) => handler.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [taskId]);

  return (
    <Dialog open={!!taskId} onClose={close} className="relative z-40">
      <DialogBackdrop className="fixed inset-0 bg-ink/40 animate-fade-in" data-testid="drawer-overlay" />
      {/* Jira-style issue view: centred and wide on desktop, full-screen on phones. */}
      <div className="fixed inset-0 flex items-stretch justify-center sm:items-center sm:p-6">
        <DialogPanel
          className="flex h-full w-full flex-col overflow-hidden bg-surface shadow-lift animate-fade-in sm:h-[min(52rem,calc(100vh-3rem))] sm:max-w-5xl sm:rounded-panel"
          data-testid="task-drawer"
        >
          {detail?.error ? (
            <>
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <DialogTitle className="text-sm font-semibold text-ink">Task unavailable</DialogTitle>
                <IconButton label="Close" onClick={close} data-autofocus>
                  <X />
                </IconButton>
              </div>
              <EmptyState
                icon={<Lock size={20} />}
                title={detail.error.code === 'FORBIDDEN' ? 'No access' : 'Task not found'}
                description={detail.error.message}
                action={<Button onClick={close}>Close</Button>}
              />
            </>
          ) : detail?.data ? (
            <TaskDetail key={detail.data.task.id} detail={detail.data} onClose={close} nav={detail.data.task.parentTaskId ? undefined : nav} />
          ) : null}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
