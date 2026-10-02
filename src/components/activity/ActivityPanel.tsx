import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useAppStore } from '@/store/appStore';
import { useUiStore } from '@/store/uiStore';
import { selectActivity, useSelector } from '@/store/selectors';
import { Avatar, EmptyState, IconButton } from '@/components/ui/primitives';
import { Activity, X } from '@/ui/icons';

function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Stretch goal: permission-filtered activity feed ("Alice moved X to Done"). */
export function ActivityPanel() {
  const open = useUiStore((s) => s.activityOpen);
  const setOpen = useUiStore((s) => s.setActivityOpen);
  const entries = useSelector(selectActivity);
  const users = useAppStore((s) => s.users);
  const containers = useAppStore((s) => s.containers);
  const tasks = useAppStore((s) => s.tasks);

  const go = async (taskId: string | null) => {
    const task = taskId ? tasks[taskId] : undefined;
    if (!task) return;
    setOpen(false);
    await useUiStore.getState().selectList(task.primaryListId);
    useUiStore.getState().openTask(task.id);
  };

  return (
    <Dialog open={open} onClose={() => setOpen(false)} className="relative z-40">
      <DialogBackdrop className="fixed inset-0 bg-ink/20 animate-fade-in" />
      <div className="fixed inset-y-0 right-0 flex">
        <DialogPanel className="flex h-full w-screen max-w-sm flex-col bg-surface shadow-drawer animate-slide-in">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <DialogTitle className="text-sm font-semibold text-ink">Activity</DialogTitle>
            <IconButton label="Close activity" onClick={() => setOpen(false)} data-autofocus>
              <X />
            </IconButton>
          </div>
          <div className="flex-1 overflow-y-auto">
            {entries.length === 0 ? (
              <EmptyState
                icon={<Activity size={20} />}
                title="No activity yet"
                description="Create, move or complete a task and it’ll show up here — only for lists you can see."
              />
            ) : (
              <ol className="divide-y divide-line">
                {entries.map((a) => {
                  const actor = users[a.actorId];
                  const where = containers[a.resourceId];
                  const clickable = a.taskId && tasks[a.taskId];
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        disabled={!clickable}
                        onClick={() => go(a.taskId)}
                        className="flex w-full gap-3 px-5 py-3 text-left transition-colors enabled:hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none disabled:cursor-default"
                      >
                        {actor && <Avatar user={actor} size="sm" />}
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-ink">
                            <span className="font-semibold">{actor?.name.split(' ')[0] ?? 'Someone'}</span> {a.message}
                          </span>
                          <span className="mt-0.5 block text-2xs text-ink-subtle">
                            {where?.name} · {timeAgo(a.at)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
