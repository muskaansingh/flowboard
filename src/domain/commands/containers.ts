import { CHILD_TYPE, type Container, type ContainerType, type ID, type Status, type Visibility } from '../types';
import { fail, ok } from '../result';
import { isEffectivelyArchived, requireAdmin, requireContainer } from '../permissions';
import { LIMITS, validateName } from '../validation';
import { childrenOf } from '../tree';
import { insertAt } from '../ordering';
import { withActivity, type CommandContext, type CommandResult } from './context';

const TYPE_LABEL: Record<ContainerType, string> = { workspace: 'Workspace', space: 'Space', folder: 'Folder', list: 'List' };

function siblingNameTaken(ctx: CommandContext, parentId: ID, name: string, exceptId?: ID): boolean {
  const lower = name.toLowerCase();
  return childrenOf(ctx.state.containers, parentId).some((c) => c.id !== exceptId && c.name.toLowerCase() === lower);
}

function renumberSiblings(containers: Record<ID, Container>, orderedIds: ID[], now: string) {
  const next = { ...containers };
  orderedIds.forEach((id, position) => {
    const c = next[id];
    if (c && c.position !== position) next[id] = { ...c, position, updatedAt: now };
  });
  return next;
}

export function defaultStatusesFor(listId: ID, newId: (p: string) => string): Status[] {
  return [
    { id: newId('st'), listId, name: 'To do', category: 'todo', color: 'slate', position: 0 },
    { id: newId('st'), listId, name: 'In progress', category: 'in_progress', color: 'blue', position: 1 },
    { id: newId('st'), listId, name: 'Done', category: 'done', color: 'green', position: 2 },
  ];
}

export interface CreateContainerInput {
  parentId: ID;
  name: string;
  /** Optional: if given it must match the only valid child type of the parent. */
  type?: ContainerType;
  visibility?: Visibility;
}

export function createContainer(ctx: CommandContext, input: CreateContainerInput): CommandResult<Container> {
  const admin = requireAdmin(ctx.state, ctx.actorId, 'create spaces, folders or lists');
  if (admin.error) return admin;

  const parentRes = requireContainer(ctx.state, ctx.actorId, input.parentId);
  if (parentRes.error) return parentRes;
  const parent = parentRes.data;

  const childType = CHILD_TYPE[parent.type];
  if (!childType) return fail('INVALID_PARENT', 'Lists hold tasks — they cannot contain other containers.');
  if (input.type && input.type !== childType) {
    return fail('INVALID_PARENT', `A ${input.type} cannot be created inside a ${parent.type}. Expected a ${childType}.`);
  }

  const nameRes = validateName(input.name, `${TYPE_LABEL[childType]} name`, LIMITS.containerName);
  if (nameRes.error) return nameRes;
  if (siblingNameTaken(ctx, parent.id, nameRes.data)) {
    return fail('CONFLICT', `A ${childType} named “${nameRes.data}” already exists here.`, { name: 'Name already in use.' });
  }

  const container: Container = {
    id: ctx.newId(childType.slice(0, 2)),
    name: nameRes.data,
    type: childType,
    parentId: parent.id,
    position: childrenOf(ctx.state.containers, parent.id).length,
    visibility: input.visibility ?? 'public',
    archivedAt: null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };

  const patch: CommandResult<Container>['data'] = {
    value: container,
    patch: {
      containers: { ...ctx.state.containers, [container.id]: container },
      activity: withActivity(ctx, { resourceId: container.id, taskId: null, message: `created ${childType} “${container.name}”` }),
    },
  };
  if (childType === 'list') {
    const statuses = defaultStatusesFor(container.id, ctx.newId);
    patch.patch.statuses = { ...ctx.state.statuses, ...Object.fromEntries(statuses.map((s) => [s.id, s])) };
  }
  return ok(patch);
}

export function renameContainer(ctx: CommandContext, id: ID, name: string): CommandResult<Container> {
  const admin = requireAdmin(ctx.state, ctx.actorId, 'rename items');
  if (admin.error) return admin;
  const res = requireContainer(ctx.state, ctx.actorId, id);
  if (res.error) return res;
  const node = res.data;
  if (node.type === 'workspace') return fail('VALIDATION', 'The workspace cannot be renamed here.');
  const nameRes = validateName(name, `${TYPE_LABEL[node.type]} name`, LIMITS.containerName);
  if (nameRes.error) return nameRes;
  if (nameRes.data === node.name) return ok({ value: node, patch: {} });
  if (node.parentId && siblingNameTaken(ctx, node.parentId, nameRes.data, node.id)) {
    return fail('CONFLICT', `A ${node.type} named “${nameRes.data}” already exists here.`, { name: 'Name already in use.' });
  }
  const updated = { ...node, name: nameRes.data, updatedAt: ctx.now };
  return ok({ value: updated, patch: { containers: { ...ctx.state.containers, [id]: updated } } });
}

/** Moves a container to `toIndex` among its (non-archived) siblings. */
export function reorderContainer(ctx: CommandContext, id: ID, toIndex: number): CommandResult<Container> {
  const admin = requireAdmin(ctx.state, ctx.actorId, 'reorder items');
  if (admin.error) return admin;
  const res = requireContainer(ctx.state, ctx.actorId, id);
  if (res.error) return res;
  const node = res.data;
  if (!node.parentId) return fail('VALIDATION', 'The workspace cannot be reordered.');
  if (!Number.isFinite(toIndex)) return fail('VALIDATION', 'Invalid position.');

  const siblings = childrenOf(ctx.state.containers, node.parentId).map((c) => c.id);
  const ordered = insertAt(siblings, id, toIndex);
  const containers = renumberSiblings(ctx.state.containers, ordered, ctx.now);
  return ok({ value: containers[id]!, patch: { containers } });
}

/**
 * Soft delete. Only the node gets `archivedAt`; descendants are hidden implicitly via
 * `isEffectivelyArchived`, so restoring the node brings the whole subtree (and its tasks) back.
 * Remaining siblings are renumbered so positions stay contiguous.
 */
export function archiveContainer(ctx: CommandContext, id: ID): CommandResult<Container> {
  const admin = requireAdmin(ctx.state, ctx.actorId, 'archive items');
  if (admin.error) return admin;
  const res = requireContainer(ctx.state, ctx.actorId, id);
  if (res.error) return res;
  const node = res.data;
  if (node.type === 'workspace' || !node.parentId) return fail('VALIDATION', 'The workspace cannot be archived.');

  const archived = { ...node, archivedAt: ctx.now, updatedAt: ctx.now };
  let containers = { ...ctx.state.containers, [id]: archived };
  const remaining = childrenOf(containers, node.parentId).map((c) => c.id);
  containers = renumberSiblings(containers, remaining, ctx.now);
  return ok({
    value: archived,
    patch: {
      containers,
      activity: withActivity(ctx, { resourceId: node.parentId, taskId: null, message: `archived ${node.type} “${node.name}”` }),
    },
  });
}

export function restoreContainer(ctx: CommandContext, id: ID): CommandResult<Container> {
  const admin = requireAdmin(ctx.state, ctx.actorId, 'restore items');
  if (admin.error) return admin;
  const node = ctx.state.containers[id];
  if (!node || !node.archivedAt) return fail('NOT_FOUND', 'Nothing to restore.');
  if (!node.parentId || isEffectivelyArchived(ctx.state.containers, node.parentId)) {
    return fail('INVALID_PARENT', 'Restore the parent first — it is archived too.');
  }
  if (siblingNameTaken(ctx, node.parentId, node.name, node.id)) {
    return fail('CONFLICT', `Another ${node.type} named “${node.name}” exists here now. Rename it first.`);
  }
  const restored = { ...node, archivedAt: null, position: childrenOf(ctx.state.containers, node.parentId).length, updatedAt: ctx.now };
  return ok({
    value: restored,
    patch: {
      containers: { ...ctx.state.containers, [id]: restored },
      activity: withActivity(ctx, { resourceId: node.id, taskId: null, message: `restored ${node.type} “${node.name}”` }),
    },
  });
}

export function setVisibility(ctx: CommandContext, id: ID, visibility: Visibility): CommandResult<Container> {
  const admin = requireAdmin(ctx.state, ctx.actorId, 'change sharing');
  if (admin.error) return admin;
  const res = requireContainer(ctx.state, ctx.actorId, id);
  if (res.error) return res;
  if (res.data.type === 'workspace') return fail('VALIDATION', 'Workspace visibility cannot be changed.');
  if (visibility !== 'public' && visibility !== 'private') return fail('VALIDATION', 'Unknown visibility.');
  const updated = { ...res.data, visibility, updatedAt: ctx.now };
  return ok({ value: updated, patch: { containers: { ...ctx.state.containers, [id]: updated } } });
}
