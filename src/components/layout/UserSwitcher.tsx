import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import type { User } from '@/domain/types';
import { useAppStore } from '@/store/appStore';
import { toast } from '@/store/toastStore';
import { useCurrentUser } from '@/store/selectors';
import { Avatar } from '@/components/ui/primitives';
import { Check, ChevronUpDown } from '@/ui/icons';
import { cx, focusRing } from '@/ui/tokens';

function RoleBadge({ user }: { user: User }) {
  return (
    <span
      className={cx(
        'rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide',
        user.role === 'admin' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600',
      )}
    >
      {user.role}
    </span>
  );
}

/** In-app identity switcher (no auth). Switching re-renders every permission-aware selector. */
export function UserSwitcher() {
  const current = useCurrentUser();
  const users = useAppStore((s) => s.users);

  const onChange = (user: User) => {
    if (user.id === current.id) return;
    useAppStore.getState().switchUser(user.id);
    toast.info(`Now viewing as ${user.name.split(' ')[0]}`, user.role === 'admin' ? 'Admin · full access' : 'Member · sees only granted items');
  };

  return (
    <Listbox value={current} onChange={onChange} by="id">
      <ListboxButton
        data-testid="user-switcher"
        className={cx(
          'flex h-9 items-center gap-2 rounded-lg bg-surface pl-1.5 pr-2 text-left ring-1 ring-inset ring-line-strong transition-colors hover:bg-canvas data-[open]:ring-brand-500',
          focusRing,
        )}
      >
        <Avatar user={current} size="sm" />
        <span className="hidden flex-col leading-none sm:flex">
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-subtle">Viewing as</span>
          <span className="mt-0.5 text-sm font-semibold text-ink">{current.name}</span>
        </span>
        <RoleBadge user={current} />
        <ChevronUpDown size={14} className="text-ink-subtle" />
      </ListboxButton>
      <ListboxOptions
        anchor="bottom end"
        className="z-50 w-64 rounded-card bg-surface p-1 shadow-pop ring-1 ring-black/5 focus:outline-none [--anchor-gap:6px]"
      >
        <p className="px-2.5 pb-1 pt-1.5 text-2xs font-medium uppercase tracking-wide text-ink-subtle">Switch user</p>
        {Object.values(users).map((u) => (
          <ListboxOption
            key={u.id}
            value={u}
            className="group flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 data-[focus]:bg-canvas"
          >
            <Avatar user={u} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{u.name}</span>
              <span className="block truncate text-2xs text-ink-muted">{u.email}</span>
            </span>
            <RoleBadge user={u} />
            <Check size={14} className="invisible text-brand-600 group-data-[selected]:visible" />
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}
