import { useAppStore } from '@/store/appStore';
import { EMPTY_FILTER, useUiStore } from '@/store/uiStore';
import { useToastStore } from '@/store/toastStore';
import { createSeed, IDS } from '@/data/seed';

/** Resets the app singletons so component tests start from a clean, instant-loading state. */
export function resetStores(userId: string = IDS.alice) {
  useAppStore.setState({ ...createSeed(), currentUserId: userId, latencyMs: 0, boot: 'loading' });
  useUiStore.setState({ selectedListId: null, drawerTaskId: null, listLoading: false, view: 'board', sort: { key: 'manual', dir: 'asc' }, activityOpen: false, sidebarCollapsed: false, mobileNavOpen: false, filter: EMPTY_FILTER, groupBy: 'none', newTaskOpen: false, paletteOpen: false, savedViews: [] });
  useToastStore.setState({ toasts: [] });
  window.location.hash = '';
}
