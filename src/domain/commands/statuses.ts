import type { ID, Status, StatusCategory, StatusColor, Task } from '../types';
import { fail, ok } from '../result';
import { requireAdmin, requireContainer } from '../permissions';
import { LIMITS, validateName, validateStatusColor } from '../validation';
import { byPosition, insertAt } from '../ordering';
import type { CommandContext, CommandResult } from './context';

const CATEGORIES: StatusCategory[] = ['todo', 'in_progress', 'done'];

export function statusesForList(statuses: Record<ID, Status>, listId: ID): Status[] {
  return Object.values(statuses).filter((s) => s.listId === listId).sort(byPosition);
}

function guardList(ctx: CommandContext, listId: ID) {
  const admin = requireAdmin(ctx.state, ctx.actorId, 'configure statuses');
  if (admin.error) return admin;
  const res = requireContainer(ctx.state, ctx.actorId, listId);
  if (res.error) return res;
  if (res.data.type !== 'list') return fail('INVALID_PARENT', 'Statuses belong to lists.');
  return res;
}

function nameTaken(list: Status[], name: string, exceptId?: ID) {
  return list.some((s) => s.id !== exceptId && s.name.toLowerCase() === name.toLowerCase());
}

export interface StatusInput {
  name: string;
  category: StatusCategory;
  color: StatusColor;
}

export function createStatus(ctx: CommandContext, listId: ID, input: StatusInput): CommandResult<Status> {
  const g = guardList(ctx, listId);
  if (g.error) return g;
  const nameRes = validateName(input.name, 'Status name', LIMITS.statusName);
  if (nameRes.error) return nameRes;
  const colorRes = validateStatusColor(input.color);
  if (colorRes.error) return colorRes;
  if (!CATEGORIES.includes(input.category)) return fail('VALIDATION', 'Unknown status category.');

  const existing = statusesForList(ctx.state.statuses, listId);
  if (nameTaken(existing, nameRes.data)) return fail('CONFLICT', `Status “${nameRes.data}” already exists in this list.`);

  // Insert after the last status of the same category so columns stay grouped todo → in progress → done.
  const lastOfCategory = [...existing].reverse().find((s) => s.category === input.category);
  const insertIndex = lastOfCategory
    ? existing.indexOf(lastOfCategory) + 1
    : input.category === 'todo'
      ? 0
      : existing.length;

  const status: Status = { id: ctx.newId('st'), listId, name: nameRes.data, category: input.category, color: colorRes.data, position: 0 };
  const ordered = insertAt(existing, status, insertIndex, (a, b) => a.id === b.id);
  const statuses = { ...ctx.state.statuses };
  ordered.forEach((s, position) => (statuses[s.id] = { ...s, position }));
  return ok({ value: statuses[status.id]!, patch: { statuses } });
}

export function updateStatus(ctx: CommandContext, id: ID, patch: Partial<StatusInput>): CommandResult<Status> {
  const current = ctx.state.statuses[id];
  if (!current) return fail('NOT_FOUND', 'Status not found.');
  const g = guardList(ctx, current.listId);
  if (g.error) return g;
  const siblings = statusesForList(ctx.state.statuses, current.listId);
  const next: Status = { ...current };

  if (patch.name !== undefined) {
    const nameRes = validateName(patch.name, 'Status name', LIMITS.statusName);
    if (nameRes.error) return nameRes;
    if (nameTaken(siblings, nameRes.data, id)) return fail('CONFLICT', `Status “${nameRes.data}” already exists in this list.`);
    next.name = nameRes.data;
  }
  if (patch.color !== undefined) {
    const colorRes = validateStatusColor(patch.color);
    if (colorRes.error) return colorRes;
    next.color = colorRes.data;
  }
  if (patch.category !== undefined && patch.category !== current.category) {
    if (!CATEGORIES.includes(patch.category)) return fail('VALIDATION', 'Unknown status category.');
    if (siblings.filter((s) => s.category === current.category).length === 1) {
      return fail('VALIDATION', `A list needs at least one “${current.category.replace('_', ' ')}” status.`);
    }
    next.category = patch.category;
  }
  return ok({ value: next, patch: { statuses: { ...ctx.state.statuses, [id]: next } } });
}

export function reorderStatus(ctx: CommandContext, id: ID, toIndex: number): CommandResult<Status> {
  const current = ctx.state.statuses[id];
  if (!current) return fail('NOT_FOUND', 'Status not found.');
  const g = guardList(ctx, current.listId);
  if (g.error) return g;
  const ordered = insertAt(statusesForList(ctx.state.statuses, current.listId), current, toIndex, (a, b) => a.id === b.id);
  const statuses = { ...ctx.state.statuses };
  ordered.forEach((s, position) => (statuses[s.id] = { ...s, position }));
  return ok({ value: statuses[id]!, patch: { statuses } });
}

/**
 * Deletes a status. If tasks use it, `reassignToId` (another status in the same list) is required
 * and those tasks are appended to that column — tasks never point at a missing status.
 */
export function deleteStatus(ctx: CommandContext, id: ID, reassignToId?: ID): CommandResult<{ moved: number }> {
  const current = ctx.state.statuses[id];
  if (!current) return fail('NOT_FOUND', 'Status not found.');
  const g = guardList(ctx, current.listId);
  if (g.error) return g;

  const siblings = statusesForList(ctx.state.statuses, current.listId);
  if (siblings.filter((s) => s.category === current.category).length === 1) {
    return fail('VALIDATION', `A list needs at least one “${current.category.replace('_', ' ')}” status.`);
  }

  const affected = Object.values(ctx.state.tasks).filter((t) => t.statusId === id);
  const tasks = { ...ctx.state.tasks };
  if (affected.length > 0) {
    const target = reassignToId ? ctx.state.statuses[reassignToId] : undefined;
    if (!target || target.listId !== current.listId || target.id === id) {
      return fail('VALIDATION', `Choose where to move the ${affected.length} task(s) in “${current.name}”.`, {
        reassignToId: 'Pick a status in this list.',
      });
    }
    const targetTop = Object.values(ctx.state.tasks).filter((t) => t.statusId === target.id && !t.parentTaskId).length;
    let offset = 0;
    for (const t of [...affected].sort(byPosition)) {
      const moved: Task = {
        ...t,
        statusId: target.id,
        position: t.parentTaskId ? t.position : targetTop + offset++,
        version: t.version + 1,
        updatedAt: ctx.now,
      };
      tasks[t.id] = moved;
    }
  }

  const statuses = { ...ctx.state.statuses };
  delete statuses[id];
  statusesForList(statuses, current.listId).forEach((s, position) => (statuses[s.id] = { ...s, position }));
  return ok({ value: { moved: affected.length }, patch: { statuses, tasks } });
}
