import type { Container, EntitiesState, Grant, ID, User } from './types';
import { fail, ok, type Result } from './result';

/**
 * Permission model
 * ----------------
 * - Admins bypass every check.
 * - A grant `{ resourceId, userId, mode }` attaches to a space, folder or list.
 * - A node is *directly accessible* to a member when:
 *     - there is no `deny` grant for them on it, AND
 *     - it is public, OR it is private and they hold an `allow` grant on it.
 * - A node is *visible* when it and every ancestor up to the workspace is directly accessible.
 *   So a deny on a space hides its whole subtree, and a private folder hides its lists from
 *   anyone without an allow on that folder.
 * - Members who can see a list can create / edit / move / delete tasks in it.
 * - Container structure (CRUD, reorder, sharing, statuses) is admin-only.
 *
 * Everything here is pure and depends only on entity state + the acting user, so it is
 * reused by the store (enforcement) and by selectors (filtering what the UI can render).
 */

type PermState = Pick<EntitiesState, 'containers' | 'grants' | 'users'>;

const grantKey = (resourceId: ID, userId: ID) => `${resourceId}::${userId}`;

/** Cached index of grants — recomputed only when the grants object identity changes. */
let grantIndexCache: { source: Record<ID, Grant> | null; index: Map<string, Grant> } = { source: null, index: new Map() };

function grantIndex(grants: Record<ID, Grant>): Map<string, Grant> {
  if (grantIndexCache.source !== grants) {
    const index = new Map<string, Grant>();
    for (const g of Object.values(grants)) index.set(grantKey(g.resourceId, g.userId), g);
    grantIndexCache = { source: grants, index };
  }
  return grantIndexCache.index;
}

export function findGrant(state: Pick<EntitiesState, 'grants'>, resourceId: ID, userId: ID): Grant | undefined {
  return grantIndex(state.grants).get(grantKey(resourceId, userId));
}

export const isAdmin = (user: User | undefined): boolean => user?.role === 'admin';

/** Direct (non-inherited) access to a single node. */
export function isDirectlyAccessible(state: PermState, node: Container, user: User): boolean {
  if (isAdmin(user) || node.type === 'workspace') return true;
  const grant = findGrant(state, node.id, user.id);
  if (grant?.mode === 'deny') return false;
  if (node.visibility === 'private') return grant?.mode === 'allow';
  return true;
}

/** Yields the node and each of its ancestors (self first). Guards against cycles. */
export function* ancestry(containers: Record<ID, Container>, id: ID): Generator<Container> {
  const seen = new Set<ID>();
  let current: Container | undefined = containers[id];
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    yield current;
    current = current.parentId ? containers[current.parentId] : undefined;
  }
}

/** True when the node or any ancestor is archived. */
export function isEffectivelyArchived(containers: Record<ID, Container>, id: ID): boolean {
  for (const node of ancestry(containers, id)) if (node.archivedAt) return true;
  return false;
}

export function canSeeContainer(state: PermState, userId: ID, containerId: ID): boolean {
  const user = state.users[userId];
  if (!user || !state.containers[containerId]) return false;
  if (isAdmin(user)) return true;
  for (const node of ancestry(state.containers, containerId)) {
    if (!isDirectlyAccessible(state, node, user)) return false;
  }
  return true;
}

/**
 * Guarded lookup used by every store read/mutation. Returns NOT_FOUND for missing / archived nodes and
 * FORBIDDEN (our client-side "403") when the user cannot see the node.
 */
export function requireContainer(
  state: PermState,
  userId: ID,
  containerId: ID,
  opts: { includeArchived?: boolean } = {},
): Result<Container> {
  const node = state.containers[containerId];
  if (!node || (!opts.includeArchived && isEffectivelyArchived(state.containers, containerId))) {
    return fail('NOT_FOUND', 'This item no longer exists or has been archived.');
  }
  if (!canSeeContainer(state, userId, containerId)) {
    return fail('FORBIDDEN', `You don't have access to this ${node.type}.`);
  }
  return ok(node);
}

/** Container structure changes (create/rename/reorder/archive/share/statuses) are admin-only. */
export function requireAdmin(state: Pick<EntitiesState, 'users'>, userId: ID, action: string): Result<User> {
  const user = state.users[userId];
  if (!user) return fail('FORBIDDEN', 'Unknown user.');
  if (!isAdmin(user)) return fail('FORBIDDEN', `Only workspace admins can ${action}.`);
  return ok(user);
}

/** Members may edit tasks in any list they can see. */
export function requireTaskEditAccess(state: PermState, userId: ID, listId: ID): Result<Container> {
  const res = requireContainer(state, userId, listId);
  if (res.error) return res;
  if (res.data.type !== 'list') return fail('INVALID_PARENT', 'Tasks can only live in lists.');
  return res;
}

/** Users who can see a given container — drives the assignee picker and assignee validation. */
export function usersWithAccess(state: PermState, containerId: ID): User[] {
  return Object.values(state.users).filter((u) => canSeeContainer(state, u.id, containerId));
}
