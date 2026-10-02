import type { GrantMode } from '@/domain/types';
import { useAppStore } from '@/store/appStore';
import { notify } from '@/store/toastStore';
import { canSeeContainer, findGrant } from '@/domain/permissions';
import { Modal } from '@/components/ui/overlays';
import { Avatar, Button, inputBase } from '@/components/ui/primitives';
import { Lock, Users } from '@/ui/icons';
import { cx } from '@/ui/tokens';
import { useDialogStore } from './dialogStore';

/** Admin-only: visibility + per-member allow/deny grants, with live "effective access" preview. */
export function SharingDialog() {
  const dialog = useDialogStore((s) => s.dialog);
  const close = useDialogStore((s) => s.close);
  const state = useAppStore();
  const open = dialog?.kind === 'sharing';
  const node = open ? state.containers[dialog.id] : undefined;
  if (!node) return null;

  const users = Object.values(state.users);

  return (
    <Modal
      open={open}
      onClose={close}
      title={`Share “${node.name}”`}
      description="Grants apply to this item and everything inside it."
      size="lg"
      footer={<Button onClick={close}>Done</Button>}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['public', 'Public', 'Visible to all members unless denied', <Users key="u" />],
              ['private', 'Private', 'Visible only with an allow grant', <Lock key="l" />],
            ] as const
          ).map(([value, title, hint, icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => notify(state.setVisibility(node.id, value))}
              aria-pressed={node.visibility === value}
              className={cx(
                'flex gap-2.5 rounded-card p-3 text-left ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                node.visibility === value ? 'bg-brand-50 ring-brand-500' : 'ring-line-strong hover:bg-canvas',
              )}
            >
              <span className={node.visibility === value ? 'text-brand-600' : 'text-ink-subtle'}>{icon}</span>
              <span>
                <span className="block text-sm font-medium text-ink">{title}</span>
                <span className="block text-2xs text-ink-muted">{hint}</span>
              </span>
            </button>
          ))}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-subtle">Members</p>
          <ul className="divide-y divide-line rounded-card ring-1 ring-line">
            {users.map((u) => {
              const grant = findGrant(state, node.id, u.id);
              const canSee = canSeeContainer(state, u.id, node.id);
              return (
                <li key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar user={u} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{u.name}</p>
                    <p className="text-2xs text-ink-muted">{u.role === 'admin' ? 'Admin' : 'Member'}</p>
                  </div>
                  <span
                    className={cx(
                      'rounded-pill px-2 py-0.5 text-2xs font-semibold',
                      canSee ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
                    )}
                  >
                    {canSee ? 'Can see' : 'Hidden'}
                  </span>
                  {u.role === 'admin' ? (
                    <span className="w-28 text-right text-2xs text-ink-subtle">Always has access</span>
                  ) : (
                    <select
                      aria-label={`Access for ${u.name}`}
                      className={cx(inputBase, 'w-28 shrink-0 py-1.5 text-xs')}
                      value={grant?.mode ?? ''}
                      onChange={(e) => notify(state.setGrant(node.id, u.id, (e.target.value || null) as GrantMode | null))}
                    >
                      <option value="">Default</option>
                      <option value="allow">Allow</option>
                      <option value="deny">Deny</option>
                    </select>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-2xs text-ink-subtle">
            “Can see” also accounts for parent folders and spaces — a deny higher up hides everything below it.
          </p>
        </div>
      </div>
    </Modal>
  );
}
