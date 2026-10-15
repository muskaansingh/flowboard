import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Comment, Container, EntitiesState, Grant, GrantMode, ID, Status, Task, User, Visibility } from '@/domain/types';
import { fail, ok, type Result } from '@/domain/result';
import { createSeed, IDS } from '@/data/seed';
import { defaultIdFactory, type CommandContext, type CommandResult } from '@/domain/commands/context';
import * as containers from '@/domain/commands/containers';
import * as tasks from '@/domain/commands/tasks';
import * as statuses from '@/domain/commands/statuses';
import * as grants from '@/domain/commands/grants';
import * as comments from '@/domain/commands/comments';

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

  addComment: (taskId: ID, body: string) => Result<Comment>;
  editComment: (id: ID, body: string) => Result<Comment>;
  deleteComment: (id: ID) => Result<{ deleted: ID }>;

  /** Snapshot of the task-related slices, taken right before an undoable action. */
  snapshot: () => UndoSnapshot;
  /**
   * Restores a snapshot — but only if nothing else touched tasks since `after` was current,
   * so undo can never silently clobber a later change.
   */
  undo: (snap: UndoSnapshot, after: Record<ID, Task>) => Result<true>;
}

export interface UndoSnapshot {
  tasks: Record<ID, Task>;
  comments: Record<ID, Comment>;
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
const STORAGE_VERSION = 2;

/** v1 → v2: tasks gain number/type/points/labels; comments slice added. Keeps the user's data. */
export function migrateV1(persisted: Record<string, unknown>): Record<string, unknown> {
  const oldTasks = (persisted.tasks ?? {}) as Record<ID, Partial<Task> & Task>;
  const ordered = Object.values(oldTasks).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const tasks: Record<ID, Task> = {};
  ordered.forEach((t, i) => {
    tasks[t.id] = { ...t, number: t.number ?? i + 1, type: t.type ?? 'task', points: t.points ?? null, labels: t.labels ?? [] };
  });
  return { ...persisted, tasks, comments: persisted.comments ?? {} };
}

export const entitiesOf = (s: EntitiesState): EntitiesState => ({
  containers: s.containers,
  tasks: s.tasks,
  statuses: s.statuses,
  users: s.users,
  grants: s.grants,
  activity: s.activity,
  comments: s.comments,
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

      addComment: (taskId, body) => run((ctx) => comments.addComment(ctx, taskId, body)),
      editComment: (id, body) => run((ctx) => comments.editComment(ctx, id, body)),
      deleteComment: (id) => run((ctx) => comments.deleteComment(ctx, id)),

      snapshot: () => ({ tasks: get().tasks, comments: get().comments }),
      undo: (snap, after) => {
        if (get().tasks !== after) return fail('CONFLICT', 'Can’t undo — this list changed since.');
        set({ tasks: snap.tasks, comments: snap.comments });
        return ok(true);
      },
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
      // v1 data is upgraded in place; unknown / older shapes fall back to fresh seed data rather than crashing.
      migrate: (persisted, version) =>
        (version === 1 && persisted && typeof persisted === 'object'
          ? migrateV1(persisted as Record<string, unknown>)
          : { ...seed(), currentUserId: IDS.alice }) as unknown as AppState,
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
