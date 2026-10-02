import { create } from 'zustand';
import type { ID } from '@/domain/types';
import { useAppStore } from './appStore';

/** Ephemeral UI state (not persisted with entities). */

export type ViewMode = 'board' | 'list';
export type SortKey = 'manual' | 'dueDate' | 'priority';
export interface SortState {
  key: SortKey;
  dir: 'asc' | 'desc';
}

interface UiState {
  selectedListId: ID | null;
  view: ViewMode;
  drawerTaskId: ID | null;
  listLoading: boolean;
  sort: SortState;
  activityOpen: boolean;
  selectList: (id: ID | null) => Promise<void>;
  setView: (view: ViewMode) => void;
  openTask: (id: ID) => void;
  closeTask: () => void;
  setSort: (sort: SortState) => void;
  setActivityOpen: (open: boolean) => void;
}

let loadToken = 0;
const sleep = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

export const useUiStore = create<UiState>()((set, get) => ({
  selectedListId: null,
  view: 'board',
  drawerTaskId: null,
  listLoading: false,
  sort: { key: 'manual', dir: 'asc' },
  activityOpen: false,

  // Simulates fetching the list's board — gives the skeleton state something real to show.
  selectList: async (id) => {
    if (id === get().selectedListId) return;
    const token = ++loadToken;
    set({ selectedListId: id, drawerTaskId: null, listLoading: id !== null });
    if (id === null) return;
    await sleep(Math.round(useAppStore.getState().latencyMs * 0.6));
    if (token === loadToken) set({ listLoading: false });
  },
  setView: (view) => set({ view }),
  openTask: (id) => set({ drawerTaskId: id }),
  closeTask: () => set({ drawerTaskId: null }),
  setSort: (sort) => set({ sort }),
  setActivityOpen: (activityOpen) => set({ activityOpen }),
}));
