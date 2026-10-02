import type { Container, EntitiesState, ID } from './types';
import { canSeeContainer, isEffectivelyArchived } from './permissions';
import { byPosition } from './ordering';

export interface TreeNode {
  container: Container;
  children: TreeNode[];
}

type TreeState = Pick<EntitiesState, 'containers' | 'grants' | 'users'>;

export function childrenOf(containers: Record<ID, Container>, parentId: ID, opts: { includeArchived?: boolean } = {}) {
  return Object.values(containers)
    .filter((c) => c.parentId === parentId && (opts.includeArchived || !c.archivedAt))
    .sort(byPosition);
}

/**
 * Builds the sidebar tree for a user. Only nodes the user can see (and that are not archived)
 * are returned — so the UI physically cannot render a node it isn't allowed to.
 */
export function buildVisibleTree(state: TreeState, userId: ID, rootId: ID): TreeNode | null {
  const root = state.containers[rootId];
  if (!root || root.archivedAt || !canSeeContainer(state, userId, rootId)) return null;

  const build = (node: Container): TreeNode => ({
    container: node,
    children: childrenOf(state.containers, node.id)
      .filter((c) => canSeeContainer(state, userId, c.id))
      .map(build),
  });
  return build(root);
}

/** All list ids visible to a user (used by search and the activity feed). */
export function visibleListIds(state: TreeState, userId: ID): Set<ID> {
  const ids = new Set<ID>();
  for (const c of Object.values(state.containers)) {
    if (c.type === 'list' && !isEffectivelyArchived(state.containers, c.id) && canSeeContainer(state, userId, c.id)) {
      ids.add(c.id);
    }
  }
  return ids;
}

/** Ids of the node and all of its descendants. */
export function subtreeIds(containers: Record<ID, Container>, id: ID): ID[] {
  const out: ID[] = [id];
  for (let i = 0; i < out.length; i++) {
    const current = out[i];
    for (const c of Object.values(containers)) if (c.parentId === current) out.push(c.id);
  }
  return out;
}

/** Breadcrumb path from workspace to node (inclusive). */
export function pathTo(containers: Record<ID, Container>, id: ID): Container[] {
  const path: Container[] = [];
  let current: Container | undefined = containers[id];
  const seen = new Set<ID>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? containers[current.parentId] : undefined;
  }
  return path;
}
