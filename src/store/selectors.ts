import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Container, EntitiesState, ID, Status, Task, User } from '@/domain/types';
import { fail, ok, type Result } from '@/domain/result';
import { canSeeContainer, isAdmin, isEffectivelyArchived, requireContainer, usersWithAccess } from '@/domain/permissions';
import { buildVisibleTree, pathTo, visibleListIds, type TreeNode } from '@/domain/tree';
import { columnTasks, subtasksOf } from '@/domain/commands/tasks';
import { statusesForList } from '@/domain/commands/statuses';
import { useAppStore, type AppState } from './appStore';

/**
 * Permission-aware read models. Each takes the full state and resolves visibility for
 * `state.currentUserId`, so components can only ever receive data the user may see.
 */

type ReadState = EntitiesState & Pick<AppState, 'currentUserId' | 'workspaceId'>;

export function selectCurrentUser(s: ReadState): User {
  return s.users[s.currentUserId]!;
}

export function selectVisibleTree(s: ReadState): TreeNode | null {
  return buildVisibleTree(s, s.currentUserId, s.workspaceId);
}

export interface ListViewModel {
  list: Container;
  path: Container[];
  statuses: Status[];
  /** Top-level tasks grouped by status id, each column ordered by position. */
  columns: Record<ID, Task[]>;
  /** Flat top-level tasks (for the list view). */
  tasks: Task[];
  subtaskCounts: Record<ID, { done: number; total: number }>;
  canManage: boolean;
}

export function selectListView(s: ReadState, listId: ID): Result<ListViewModel> {
  const res = requireContainer(s, s.currentUserId, listId);
  if (res.error) return res;
  if (res.data.type !== 'list') return fail('INVALID_PARENT', 'Only lists have boards.');
  const statuses = statusesForList(s.statuses, listId);
  const columns: Record<ID, Task[]> = {};
  for (const st of statuses) columns[st.id] = columnTasks(s.tasks, listId, st.id);

  const subtaskCounts: ListViewModel['subtaskCounts'] = {};
  for (const t of Object.values(s.tasks)) {
    if (t.primaryListId !== listId || !t.parentTaskId) continue;
    const entry = (subtaskCounts[t.parentTaskId] ??= { done: 0, total: 0 });
    entry.total += 1;
    if (s.statuses[t.statusId]?.category === 'done') entry.done += 1;
  }

  return ok({
    list: res.data,
    path: pathTo(s.containers, listId),
    statuses,
    columns,
    tasks: statuses.flatMap((st) => columns[st.id] ?? []),
    subtaskCounts,
    canManage: isAdmin(s.users[s.currentUserId]),
  });
}

export interface TaskDetailModel {
  task: Task;
  list: Container;
  statuses: Status[];
  subtasks: Task[];
  parent: Task | null;
  assignable: User[];
  /** Lists the user can move this task to. */
  moveTargets: Container[];
}

export function selectTaskDetail(s: ReadState, taskId: ID): Result<TaskDetailModel> {
  const task = s.tasks[taskId];
  if (!task) return fail('NOT_FOUND', 'This task no longer exists.');
  const listRes = requireContainer(s, s.currentUserId, task.primaryListId);
  if (listRes.error) {
    return listRes.error.code === 'FORBIDDEN' ? fail('FORBIDDEN', "You don't have access to this task.") : listRes;
  }
  const visible = visibleListIds(s, s.currentUserId);
  return ok({
    task,
    list: listRes.data,
    statuses: statusesForList(s.statuses, task.primaryListId),
    subtasks: subtasksOf(s.tasks, task.id),
    parent: task.parentTaskId ? (s.tasks[task.parentTaskId] ?? null) : null,
    assignable: usersWithAccess(s, task.primaryListId),
    moveTargets: [...visible].map((id) => s.containers[id]!).sort((a, b) => a.name.localeCompare(b.name)),
  });
}

export interface SearchHit {
  task: Task;
  list: Container;
  status: Status | undefined;
}

/** Client-side search across title + description of every task the user can see. */
export function selectSearch(s: ReadState, query: string, limit = 20): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const visible = visibleListIds(s, s.currentUserId);
  const hits: SearchHit[] = [];
  for (const t of Object.values(s.tasks)) {
    if (!visible.has(t.primaryListId)) continue;
    if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) continue;
    hits.push({ task: t, list: s.containers[t.primaryListId]!, status: s.statuses[t.statusId] });
  }
  return hits
    .sort((a, b) => Number(b.task.title.toLowerCase().startsWith(q)) - Number(a.task.title.toLowerCase().startsWith(q)))
    .slice(0, limit);
}

/** Activity entries filtered to resources the current user can see. */
export function selectActivity(s: ReadState) {
  return s.activity.filter(
    (a) => s.containers[a.resourceId] && !isEffectivelyArchived(s.containers, a.resourceId) && canSeeContainer(s, s.currentUserId, a.resourceId),
  );
}

/** Archived containers (top-most archived node only) — admin only. */
export function selectArchived(s: ReadState): Container[] {
  if (!isAdmin(s.users[s.currentUserId])) return [];
  return Object.values(s.containers).filter((c) => c.archivedAt && c.parentId && !isEffectivelyArchived(s.containers, c.parentId));
}

/* ------------------------------------------------------------------ hooks */

/** Subscribes to the entity slices + current user, shallowly — stable unless something changed. */
export function useReadState(): ReadState {
  return useAppStore(
    useShallow((s) => ({
      containers: s.containers,
      tasks: s.tasks,
      statuses: s.statuses,
      users: s.users,
      grants: s.grants,
      activity: s.activity,
      currentUserId: s.currentUserId,
      workspaceId: s.workspaceId,
    })),
  );
}

/** Memoised permission-aware selector. Pass any external inputs (ids, queries) as `deps`. */
export function useSelector<T>(fn: (s: ReadState) => T, deps: readonly unknown[] = []): T {
  const s = useReadState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => fn(s), [s, ...deps]);
}

export const useCurrentUser = () => useAppStore((s) => s.users[s.currentUserId]!);
export const useIsAdmin = () => useAppStore((s) => isAdmin(s.users[s.currentUserId]));
