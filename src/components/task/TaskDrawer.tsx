import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useUiStore } from '@/store/uiStore';
import { selectTaskDetail, useSelector } from '@/store/selectors';
import { Button, EmptyState, IconButton } from '@/components/ui/primitives';
import { Lock, X } from '@/ui/icons';
import { TaskDetail } from './TaskDetail';

/**
 * Right-hand task drawer. Headless UI's Dialog gives us: focus trap, focus restore to the card
 * or row that opened it, Escape-to-close and overlay-click-to-close.
 */
export function TaskDrawer() {
  const taskId = useUiStore((s) => s.drawerTaskId);
  const close = useUiStore((s) => s.closeTask);
  const detail = useSelector((s) => (taskId ? selectTaskDetail(s, taskId) : null), [taskId]);

  return (
    <Dialog open={!!taskId} onClose={close} className="relative z-40">
      <DialogBackdrop className="fixed inset-0 bg-ink/20 animate-fade-in" data-testid="drawer-overlay" />
      <div className="fixed inset-y-0 right-0 flex max-w-full">
        <DialogPanel
          className="flex h-full w-screen max-w-xl flex-col bg-surface shadow-drawer animate-slide-in"
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
            <TaskDetail key={detail.data.task.id} detail={detail.data} onClose={close} />
          ) : null}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
