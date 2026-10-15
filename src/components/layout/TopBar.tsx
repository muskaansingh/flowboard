import { useAppStore } from '@/store/appStore';
import { useUiStore } from '@/store/uiStore';
import { pathTo } from '@/domain/tree';
import { canSeeContainer } from '@/domain/permissions';
import { Button, IconButton } from '@/components/ui/primitives';
import { useShortcut } from '@/hooks/useShortcut';
import { Activity, ChevronRight, PanelLeft } from '@/ui/icons';
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
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  useShortcut('[', toggleSidebar);
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 lg:gap-4 lg:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <IconButton label="Show sidebar ( [ )" onClick={toggleSidebar} className={sidebarCollapsed ? '' : 'lg:hidden'}>
          <PanelLeft size={16} />
        </IconButton>
        <Breadcrumbs />
      </div>
      <SearchBox />
      <div className="flex shrink-0 items-center justify-end gap-2 lg:flex-1">
        <Button variant="ghost" icon={<Activity size={15} />} aria-label="Activity" title="Activity" className="px-2.5 lg:px-3.5" onClick={() => setActivityOpen(true)}>
          <span className="hidden lg:inline">Activity</span>
        </Button>
        <UserSwitcher />
      </div>
    </header>
  );
}
