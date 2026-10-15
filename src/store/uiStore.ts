import { create } from 'zustand';
import type { ID, Priority } from '@/domain/types';
import { useAppStore } from './appStore';

/** Ephemeral UI state (not persisted with entities). */

export type ViewMode = 'board' | 'list';
export type GroupBy = 'none' | 'status' | 'assignee' | 'priority';
export type SortKey = 'manual' | 'dueDate' | 'priority';
export interface SortState {
  key: SortKey;
  dir: 'asc' | 'desc';
}

export type DueFilter = 'overdue' | 'today' | 'week' | 'none';
/** Sentinel in `assigneeIds` that matches tasks with nobody assigned. */
export const UNASSIGNED = '__unassigned__';

export interface TaskFilter {
  query: string;
  mine: boolean;
  statusIds: ID[];
  assigneeIds: ID[];
  priorities: Priority[];
  due: DueFilter[];
  labels: string[];
}

const PREFS_KEY = 'flowboard:ui';
export interface SavedView {
  id: string;
  name: string;
  listId: ID;
  filter: TaskFilter;
}
type Prefs = { view?: ViewMode; sidebarCollapsed?: boolean; groupBy?: GroupBy; savedViews?: SavedView[] };
const readPrefs = (): Prefs => {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Prefs;
  } catch {
    return {};
  }
};
const writePrefs = (patch: Prefs) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...readPrefs(), ...patch }));
  } catch {
    /* storage unavailable — preference just won't persist */
  }
};
const prefs = readPrefs();

interface UiState {
  selectedListId: ID | null;
  view: ViewMode;
  drawerTaskId: ID | null;
  listLoading: boolean;
  sort: SortState;
  activityOpen: boolean;
  /** Desktop: sidebar collapsed (persisted). Mobile: off-canvas drawer open (ephemeral). */
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  filter: TaskFilter;
  /** List-view grouping (persisted). */
  groupBy: GroupBy;
  newTaskOpen: boolean;
  paletteOpen: boolean;
  /** Named filter sets, per list, kept in this browser. */
  savedViews: SavedView[];
  selectList: (id: ID | null) => Promise<void>;
  setView: (view: ViewMode) => void;
  openTask: (id: ID) => void;
  closeTask: () => void;
  setSort: (sort: SortState) => void;
  setActivityOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
  setFilter: (patch: Partial<TaskFilter>) => void;
  clearFilter: () => void;
  setGroupBy: (groupBy: GroupBy) => void;
  setNewTaskOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  saveView: (name: string) => SavedView | null;
  deleteView: (id: string) => void;
}

export const EMPTY_FILTER: TaskFilter = { query: '', mine: false, statusIds: [], assigneeIds: [], priorities: [], due: [], labels: [] };

let loadToken = 0;
const sleep = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

export const useUiStore = create<UiState>()((set, get) => ({
  selectedListId: null,
  view: prefs.view === 'list' ? 'list' : 'board',
  drawerTaskId: null,
  listLoading: false,
  sort: { key: 'manual', dir: 'asc' },
  activityOpen: false,
  sidebarCollapsed: prefs.sidebarCollapsed ?? false,
  mobileNavOpen: false,
  filter: EMPTY_FILTER,
  groupBy: prefs.groupBy ?? 'none',
  newTaskOpen: false,
  paletteOpen: false,
  savedViews: Array.isArray(prefs.savedViews) ? prefs.savedViews : [],

  // Simulates fetching the list's board — gives the skeleton state something real to show.
  selectList: async (id) => {
    if (id === get().selectedListId) return;
    const token = ++loadToken;
    set({ selectedListId: id, drawerTaskId: null, listLoading: id !== null, mobileNavOpen: false, filter: EMPTY_FILTER });
    if (id === null) return;
    await sleep(Math.round(useAppStore.getState().latencyMs * 0.6));
    if (token === loadToken) set({ listLoading: false });
  },
  setView: (view) => {
    writePrefs({ view });
    set({ view });
  },
  openTask: (id) => set({ drawerTaskId: id }),
  closeTask: () => set({ drawerTaskId: null }),
  setSort: (sort) => set({ sort }),
  setActivityOpen: (activityOpen) => set({ activityOpen }),
  toggleSidebar: () => {
    // Below lg the sidebar is an overlay drawer; above it, a persisted collapse.
    if (window.matchMedia?.('(max-width: 1023px)').matches) return set({ mobileNavOpen: !get().mobileNavOpen });
    const sidebarCollapsed = !get().sidebarCollapsed;
    writePrefs({ sidebarCollapsed });
    set({ sidebarCollapsed });
  },
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  setFilter: (patch) => set({ filter: { ...get().filter, ...patch } }),
  clearFilter: () => set({ filter: EMPTY_FILTER }),
  setNewTaskOpen: (newTaskOpen) => set({ newTaskOpen }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  saveView: (name) => {
    const { selectedListId, filter, savedViews } = get();
    const trimmed = name.trim().slice(0, 40);
    if (!selectedListId || !trimmed) return null;
    const view: SavedView = { id: `v_${Date.now().toString(36)}`, name: trimmed, listId: selectedListId, filter };
    const next = [...savedViews.filter((v) => !(v.listId === selectedListId && v.name === trimmed)), view];
    writePrefs({ savedViews: next });
    set({ savedViews: next });
    return view;
  },
  deleteView: (id) => {
    const next = get().savedViews.filter((v) => v.id !== id);
    writePrefs({ savedViews: next });
    set({ savedViews: next });
  },
  setGroupBy: (groupBy) => {
    writePrefs({ groupBy });
    set({ groupBy });
  },
}));
