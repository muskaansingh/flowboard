import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { useUiStore } from '@/store/uiStore';
import { visibleListIds } from '@/domain/tree';

/**
 * Tiny hash router: `#/list/<listId>` and `#/list/<listId>/task/<taskId>`.
 * Deep links let you try opening a list you can't see (→ 403 panel), and back/forward work.
 */
const parse = (hash: string) => {
  const m = hash.match(/^#\/list\/([^/]+)(?:\/task\/([^/]+))?/);
  return { listId: m?.[1] ?? null, taskId: m?.[2] ?? null };
};

const build = (listId: string | null, taskId: string | null) =>
  listId ? `#/list/${listId}${taskId ? `/task/${taskId}` : ''}` : '#/';

export function useHashRoute() {
  const boot = useAppStore((s) => s.boot);

  // Store → URL
  useEffect(
    () =>
      useUiStore.subscribe((s, prev) => {
        if (s.selectedListId === prev.selectedListId && s.drawerTaskId === prev.drawerTaskId) return;
        const next = build(s.selectedListId, s.drawerTaskId);
        if (window.location.hash === next) return;
        if (s.selectedListId !== prev.selectedListId) window.history.pushState(null, '', next);
        else window.history.replaceState(null, '', next);
      }),
    [],
  );

  // URL → store (initial load + back/forward)
  useEffect(() => {
    if (boot !== 'ready') return;
    const apply = async () => {
      const { listId, taskId } = parse(window.location.hash);
      const ui = useUiStore.getState();
      if (listId) {
        await ui.selectList(listId);
        if (taskId) useUiStore.getState().openTask(taskId);
        else useUiStore.getState().closeTask();
      } else if (ui.selectedListId === null) {
        // First visit: open the first list the user can see.
        const s = useAppStore.getState();
        const first = [...visibleListIds(s, s.currentUserId)]
          .map((id) => s.containers[id]!)
          .sort((a, b) => a.position - b.position)[0];
        if (first) await ui.selectList(first.id);
      } else {
        void ui.selectList(null);
      }
    };
    void apply();
    const onPop = () => void apply();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [boot]);
}
