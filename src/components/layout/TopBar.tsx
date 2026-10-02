import { useAppStore } from '@/store/appStore';
import { useUiStore } from '@/store/uiStore';
import { pathTo } from '@/domain/tree';
import { canSeeContainer } from '@/domain/permissions';
import { Button } from '@/components/ui/primitives';
import { Activity, ChevronRight } from '@/ui/icons';
import { SearchBox } from './SearchBox';
import { UserSwitcher } from './UserSwitcher';

function Breadcrumbs() {
  const listId = useUiStore((s) => s.selectedListId);
  const containers = useAppStore((s) => s.containers);
  const state = useAppStore();
  if (!listId || !containers[listId] || !canSeeContainer(state, state.currentUserId, listId)) {
    return <span className="text-sm font-medium text-ink-muted">Home</span>;
  }
  const path = pathTo(containers, listId).slice(1);
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
      {path.map((c, i) => (
        <span key={c.id} className="flex min-w-0 items-center gap-1">
          {i > 0 && <ChevronRight size={13} className="shrink-0 text-ink-subtle" />}
          <span className={i === path.length - 1 ? 'truncate font-semibold text-ink' : 'truncate text-ink-muted'}>{c.name}</span>
        </span>
      ))}
    </nav>
  );
}

export function TopBar() {
  const setActivityOpen = useUiStore((s) => s.setActivityOpen);
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface px-5">
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>
      <SearchBox />
      <div className="flex flex-1 items-center justify-end gap-2">
        <Button variant="ghost" icon={<Activity size={15} />} onClick={() => setActivityOpen(true)}>
          Activity
        </Button>
        <UserSwitcher />
      </div>
    </header>
  );
}
