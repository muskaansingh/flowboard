import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Container, EntitiesState, Grant, GrantMode, ID, Status, Task, User, Visibility } from '@/domain/types';
import { fail, ok, type Result } from '@/domain/result';
import { createSeed, IDS } from '@/data/seed';
import { defaultIdFactory, type CommandContext, type CommandResult } from '@/domain/commands/context';
import * as containers from '@/domain/commands/containers';
import * as tasks from '@/domain/commands/tasks';
import * as statuses from '@/domain/commands/statuses';
import * as grants from '@/domain/commands/grants';

/**
 * The single client data layer (stands in for API + DB).
 *
 * - Entity state is normalised maps (see `EntitiesState`).
 * - Every mutation goes through `run()`, which builds a CommandContext for the *current user*
 *   and executes a pure command from `src/domain/commands`. Commands enforce permissions and
 *   validation and return `{ data }` or `{ error: { code, message } }`. On error nothing is written.
 * - Reads that the UI needs permission-filtered live in `src/store/selectors.ts`.
 */

export interface AppState extends EntitiesState {
  workspaceId: ID;
  currentUserId: ID;
  boot: 'loading' | 'ready';
  /** Simulated network latency for "queries" (first load, list switch). 0 in tests. */
  latencyMs: number;

  bootstrap: () => Promise<void>;
  switchUser: (userId: ID) => Result<User>;
  resetDemo: () => void;

  createContainer: (input: containers.CreateContainerInput) => Result<Container>;
  renameContainer: (id: ID, name: string) => Result<Container>;
  reorderContainer: (id: ID, toIndex: number) => Result<Container>;
  archiveContainer: (id: ID) => Result<Container>;
  restoreContainer: (id: ID) => Result<Container>;
  setVisibility: (id: ID, visibility: Visibility) => Result<Container>;
  setGrant: (resourceId: ID, userId: ID, mode: GrantMode | null) => Result<Grant | null>;

  createStatus: (listId: ID, input: statuses.StatusInput) => Result<Status>;
  updateStatus: (id: ID, patch: Partial<statuses.StatusInput>) => Result<Status>;
  reorderStatus: (id: ID, toIndex: number) => Result<Status>;
  deleteStatus: (id: ID, reassignToId?: ID) => Result<{ moved: number }>;

  createTask: (listId: ID, input: tasks.CreateTaskInput) => Result<Task>;
  updateTask: (
    id: ID,
    patch: tasks.UpdateTaskPatch,
    opts?: { expectedVersion?: number },
  ) => Result<Task>;
  moveTask: (id: ID, input: tasks.MoveTaskInput) => Result<tasks.MoveTaskOutput>;
  deleteTask: (id: ID) => Result<{ deleted: ID[] }>;
}

export interface CreateStoreOptions {
  seed?: EntitiesState;
  persist?: boolean;
  latencyMs?: number;
  now?: () => Date;
  newId?: (prefix: string) => string;
  initialUserId?: ID;
}

export const STORAGE_KEY = 'flowboard:v1';
const STORAGE_VERSION = 1;

export const entitiesOf = (s: EntitiesState): EntitiesState => ({
  containers: s.containers,
  tasks: s.tasks,
  statuses: s.statuses,
  users: s.users,
  grants: s.grants,
  activity: s.activity,
});

const sleep = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

export function createAppStore(options: CreateStoreOptions = {}) {
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? defaultIdFactory;
  const seed = () => options.seed ?? createSeed(now());

  type Set = (partial: Partial<AppState>) => void;
  type Get = () => AppState;

  const initializer = (set: Set, get: Get): AppState => {
    const run = <T>(command: (ctx: CommandContext) => CommandResult<T>): Result<T> => {
      const s = get();
      const res = command({ state: entitiesOf(s), actorId: s.currentUserId, now: now().toISOString(), newId });
      if (res.error) return res;
      if (Object.keys(res.data.patch).length > 0) set(res.data.patch);
      return ok(res.data.value);
    };

    return {
      ...seed(),
      workspaceId: IDS.workspace,
      currentUserId: options.initialUserId ?? IDS.alice,
      boot: 'loading',
      latencyMs: options.latencyMs ?? 450,

      bootstrap: async () => {
        set({ boot: 'loading' });
        await sleep(get().latencyMs);
        set({ boot: 'ready' });
      },

      switchUser: (userId) => {
        const user = get().users[userId];
        if (!user) return fail('NOT_FOUND', 'Unknown user.');
        set({ currentUserId: userId });
        return ok(user);
      },

      resetDemo: () => set({ ...createSeed(now()), currentUserId: IDS.alice }),

      createContainer: (input) => run((ctx) => containers.createContainer(ctx, input)),
      renameContainer: (id, name) => run((ctx) => containers.renameContainer(ctx, id, name)),
      reorderContainer: (id, toIndex) => run((ctx) => containers.reorderContainer(ctx, id, toIndex)),
      archiveContainer: (id) => run((ctx) => containers.archiveContainer(ctx, id)),
      restoreContainer: (id) => run((ctx) => containers.restoreContainer(ctx, id)),
      setVisibility: (id, visibility) => run((ctx) => containers.setVisibility(ctx, id, visibility)),
      setGrant: (resourceId, userId, mode) => run((ctx) => grants.setGrant(ctx, resourceId, userId, mode)),

      createStatus: (listId, input) => run((ctx) => statuses.createStatus(ctx, listId, input)),
      updateStatus: (id, patch) => run((ctx) => statuses.updateStatus(ctx, id, patch)),
      reorderStatus: (id, toIndex) => run((ctx) => statuses.reorderStatus(ctx, id, toIndex)),
      deleteStatus: (id, reassignToId) => run((ctx) => statuses.deleteStatus(ctx, id, reassignToId)),

      createTask: (listId, input) => run((ctx) => tasks.createTask(ctx, listId, input)),
      updateTask: (id, patch, opts) => run((ctx) => tasks.updateTask(ctx, id, patch, opts)),
      moveTask: (id, input) => run((ctx) => tasks.moveTask(ctx, id, input)),
      deleteTask: (id) => run((ctx) => tasks.deleteTask(ctx, id)),
    };
  };

  if (!options.persist) {
    return create<AppState>()((set, get) => initializer(set, get));
  }

  return create<AppState>()(
    persist((set, get) => initializer(set, get), {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ ...entitiesOf(s), currentUserId: s.currentUserId }),
      // Unknown / older shapes fall back to fresh seed data rather than crashing.
      migrate: () => ({ ...seed(), currentUserId: IDS.alice }) as unknown as AppState,
    }),
  );
}

export type AppStore = ReturnType<typeof createAppStore>;

/** App-wide singleton (persisted to localStorage). Tests create isolated stores with `createAppStore()`. */
export const useAppStore = createAppStore({ persist: true });

/** Re-reads persisted state (used for cross-tab sync). No-op for non-persisted stores. */
export function rehydrateFromStorage(store: AppStore = useAppStore): Promise<void> | void {
  return (store as unknown as { persist?: { rehydrate: () => Promise<void> } }).persist?.rehydrate();
}
