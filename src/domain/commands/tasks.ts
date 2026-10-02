import type { EntitiesState, ID, Priority, Status, Task } from '../types';
import { fail, ok, type Result } from '../result';
import { canSeeContainer, requireTaskEditAccess } from '../permissions';
import { validateDescription, validateDueDate, validatePriority, validateTitle } from '../validation';
import { byPosition, insertAt } from '../ordering';
import { statusesForList } from './statuses';
import { withActivity, type CommandContext, type CommandResult } from './context';

/* ------------------------------------------------------------------ helpers */

/** Top-level tasks of one kanban column, ordered. */
export function columnTasks(tasks: Record<ID, Task>, listId: ID, statusId: ID, excludeId?: ID): Task[] {
  return Object.values(tasks)
    .filter((t) => t.primaryListId === listId && t.statusId === statusId && !t.parentTaskId && t.id !== excludeId)
    .sort(byPosition);
}

export function subtasksOf(tasks: Record<ID, Task>, parentId: ID): Task[] {
  return Object.values(tasks)
    .filter((t) => t.parentTaskId === parentId)
    .sort(byPosition);
}

function renumber(tasks: Record<ID, Task>, ordered: Task[], now: string, touchedId?: ID) {
  ordered.forEach((t, position) => {
    const current = tasks[t.id]!;
    if (current.position !== position || t.id === touchedId) {
      tasks[t.id] = { ...current, position, ...(t.id === touchedId ? {} : { updatedAt: now }) };
    }
  });
}

/** Locates a task the actor is allowed to edit (via its list). */
function requireTask(ctx: CommandContext, id: ID): Result<Task> {
  const task = ctx.state.tasks[id];
  if (!task) return fail('NOT_FOUND', 'This task no longer exists.');
  const access = requireTaskEditAccess(ctx.state, ctx.actorId, task.primaryListId);
  if (access.error) {
    return access.error.code === 'FORBIDDEN' ? fail('FORBIDDEN', "You don't have access to this task.") : access;
  }
  return ok(task);
}

function requireStatusInList(state: EntitiesState, statusId: ID, listId: ID): Result<Status> {
  const status = state.statuses[statusId];
  if (!status || status.listId !== listId) {
    return fail('VALIDATION', 'That status does not exist on this list.', { statusId: 'Pick a status from this list.' });
  }
  return ok(status);
}

function validateAssignees(state: EntitiesState, listId: ID, raw: unknown): Result<ID[]> {
  if (raw === undefined) return ok([]);
  if (!Array.isArray(raw)) return fail('VALIDATION', 'Assignees must be a list of users.');
  const ids = [...new Set(raw as ID[])];
  for (const id of ids) {
    const user = state.users[id];
    if (!user) return fail('VALIDATION', 'Unknown assignee.', { assigneeIds: 'Unknown user.' });
    if (!canSeeContainer(state, id, listId)) {
      return fail('VALIDATION', `${user.name} doesn't have access to this list, so can't be assigned.`, {
        assigneeIds: `${user.name} has no access.`,
      });
    }
  }
  return ok(ids);
}

/**
 * Places a top-level task into (listId, statusId) at `index`, renumbering both the source and the
 * target column so positions stay contiguous. Mutates the given `tasks` copy.
 */
function placeInColumn(tasks: Record<ID, Task>, task: Task, listId: ID, statusId: ID, index: number | undefined, now: string) {
  const sameColumn = task.primaryListId === listId && task.statusId === statusId;
  const target = columnTasks(tasks, listId, statusId, task.id);
  const moved: Task = { ...task, primaryListId: listId, statusId, version: task.version + 1, updatedAt: now };
  tasks[task.id] = moved;
  if (!sameColumn) renumber(tasks, columnTasks(tasks, task.primaryListId, task.statusId, task.id), now);
  renumber(tasks, insertAt(target, moved, index ?? target.length, (a, b) => a.id === b.id), now, task.id);
}

/** When moving to another list, keep the status category if possible (in progress → in progress). */
function mapStatus(state: EntitiesState, fromStatusId: ID, toListId: ID): Status | undefined {
  const targetStatuses = statusesForList(state.statuses, toListId);
  const from = state.statuses[fromStatusId];
  return targetStatuses.find((s) => from && s.category === from.category) ?? targetStatuses[0];
}

/* ------------------------------------------------------------------ commands */

export interface CreateTaskInput {
  title: string;
  description?: string;
  statusId?: ID;
  priority?: Priority;
  assigneeIds?: ID[];
  dueDate?: string | null;
  parentTaskId?: ID | null;
}

export function createTask(ctx: CommandContext, listId: ID, input: CreateTaskInput): CommandResult<Task> {
  const access = requireTaskEditAccess(ctx.state, ctx.actorId, listId);
  if (access.error) return access;

  const title = validateTitle(input.title);
  if (title.error) return title;
  const description = validateDescription(input.description);
  if (description.error) return description;
  const priority = validatePriority(input.priority);
  if (priority.error) return priority;
  const dueDate = validateDueDate(input.dueDate);
  if (dueDate.error) return dueDate;
  const assignees = validateAssignees(ctx.state, listId, input.assigneeIds);
  if (assignees.error) return assignees;

  let parent: Task | undefined;
  if (input.parentTaskId) {
    parent = ctx.state.tasks[input.parentTaskId];
    if (!parent || parent.primaryListId !== listId) return fail('INVALID_PARENT', 'Parent task must be in the same list.');
    if (parent.parentTaskId) return fail('INVALID_PARENT', 'Subtasks can only be one level deep.');
  }

  const listStatuses = statusesForList(ctx.state.statuses, listId);
  const statusId = input.statusId ?? listStatuses.find((s) => s.category === 'todo')?.id ?? listStatuses[0]?.id;
  if (!statusId) return fail('VALIDATION', 'This list has no statuses configured.');
  const status = requireStatusInList(ctx.state, statusId, listId);
  if (status.error) return status;

  const position = parent
    ? subtasksOf(ctx.state.tasks, parent.id).length
    : columnTasks(ctx.state.tasks, listId, statusId).length;

  const task: Task = {
    id: ctx.newId('tk'),
    title: title.data,
    description: description.data,
    statusId,
    priority: priority.data,
    assigneeIds: assignees.data,
    dueDate: dueDate.data,
    position,
    primaryListId: listId,
    parentTaskId: parent?.id ?? null,
    version: 1,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };

  return ok({
    value: task,
    patch: {
      tasks: { ...ctx.state.tasks, [task.id]: task },
      activity: withActivity(ctx, {
        resourceId: listId,
        taskId: parent?.id ?? task.id,
        message: parent ? `added subtask “${task.title}” to “${parent.title}”` : `created “${task.title}”`,
      }),
    },
  });
}

export interface UpdateTaskPatch {
  title?: string;
  description?: string;
  priority?: Priority;
  assigneeIds?: ID[];
  dueDate?: string | null;
  statusId?: ID;
}

export function updateTask(
  ctx: CommandContext,
  id: ID,
  patch: UpdateTaskPatch,
  opts: { expectedVersion?: number } = {},
): CommandResult<Task> {
  const res = requireTask(ctx, id);
  if (res.error) return res;
  const task = res.data;
  if (opts.expectedVersion !== undefined && opts.expectedVersion !== task.version) {
    return fail('CONFLICT', 'This task changed since you opened it. Review the latest version and try again.');
  }

  const next: Task = { ...task };
  const fields: Record<string, string> = {};
  const collect = <T>(r: Result<T>, apply: (v: T) => void) => {
    if (r.error) Object.assign(fields, r.error.fields ?? { _: r.error.message });
    else apply(r.data);
  };
  if (patch.title !== undefined) collect(validateTitle(patch.title), (v) => (next.title = v));
  if (patch.description !== undefined) collect(validateDescription(patch.description), (v) => (next.description = v));
  if (patch.priority !== undefined) collect(validatePriority(patch.priority), (v) => (next.priority = v));
  if (patch.dueDate !== undefined) collect(validateDueDate(patch.dueDate), (v) => (next.dueDate = v));
  if (patch.assigneeIds !== undefined) {
    collect(validateAssignees(ctx.state, task.primaryListId, patch.assigneeIds), (v) => (next.assigneeIds = v));
  }
  if (patch.statusId !== undefined) collect(requireStatusInList(ctx.state, patch.statusId, task.primaryListId), () => {});
  if (Object.keys(fields).length) {
    return fail('VALIDATION', Object.values(fields)[0] ?? 'Please fix the highlighted fields.', fields);
  }

  const tasks = { ...ctx.state.tasks };
  const statusChanged = patch.statusId !== undefined && patch.statusId !== task.statusId;
  if (statusChanged && !task.parentTaskId) {
    // Status change on a top-level task = move to the end of the new kanban column.
    placeInColumn(tasks, next, task.primaryListId, patch.statusId!, undefined, ctx.now);
  } else {
    tasks[id] = { ...next, statusId: patch.statusId ?? task.statusId, version: task.version + 1, updatedAt: ctx.now };
  }

  const statusName = statusChanged ? ctx.state.statuses[patch.statusId!]?.name : undefined;
  return ok({
    value: tasks[id]!,
    patch: {
      tasks,
      activity: withActivity(ctx, {
        resourceId: task.primaryListId,
        taskId: task.parentTaskId ?? id,
        message: statusName ? `moved “${next.title}” to ${statusName}` : `updated “${next.title}”`,
      }),
    },
  });
}

export interface MoveTaskInput {
  /** Target list. Omit to stay in the current list. */
  listId?: ID;
  /** Target status (kanban column). Omit to keep / auto-map. */
  statusId?: ID;
  /** Target index inside the column. Omit to append. */
  index?: number;
}

export interface MoveTaskOutput {
  task: Task;
  /** Assignees removed because they cannot access the destination list. */
  unassigned: ID[];
}

/**
 * Handles every drag / move: reorder within a column, change column, or move to another list.
 * Moving between lists maps the status by category and carries subtasks along.
 */
export function moveTask(ctx: CommandContext, id: ID, input: MoveTaskInput): CommandResult<MoveTaskOutput> {
  const res = requireTask(ctx, id);
  if (res.error) return res;
  const task = res.data;
  const targetListId = input.listId ?? task.primaryListId;
  const crossList = targetListId !== task.primaryListId;

  if (task.parentTaskId) {
    if (crossList) return fail('INVALID_PARENT', 'Subtasks move with their parent task.');
    if (input.statusId === undefined) return fail('VALIDATION', 'Nothing to move.');
  }
  if (input.index !== undefined && (!Number.isFinite(input.index) || input.index < 0)) {
    return fail('VALIDATION', 'Invalid position.');
  }

  if (crossList) {
    const access = requireTaskEditAccess(ctx.state, ctx.actorId, targetListId);
    if (access.error) return access;
  }

  let targetStatusId = input.statusId;
  if (targetStatusId) {
    const st = requireStatusInList(ctx.state, targetStatusId, targetListId);
    if (st.error) return st;
  } else {
    targetStatusId = crossList ? mapStatus(ctx.state, task.statusId, targetListId)?.id : task.statusId;
    if (!targetStatusId) return fail('VALIDATION', 'The destination list has no statuses.');
  }

  const tasks = { ...ctx.state.tasks };
  let unassigned: ID[] = [];

  if (task.parentTaskId) {
    tasks[id] = { ...task, statusId: targetStatusId, version: task.version + 1, updatedAt: ctx.now };
  } else {
    let moving = task;
    if (crossList) {
      unassigned = task.assigneeIds.filter((uid) => !canSeeContainer(ctx.state, uid, targetListId));
      moving = { ...task, assigneeIds: task.assigneeIds.filter((uid) => !unassigned.includes(uid)) };
    }
    placeInColumn(tasks, moving, targetListId, targetStatusId, input.index, ctx.now);

    if (crossList) {
      for (const st of subtasksOf(ctx.state.tasks, id)) {
        tasks[st.id] = {
          ...st,
          primaryListId: targetListId,
          statusId: mapStatus(ctx.state, st.statusId, targetListId)?.id ?? targetStatusId,
          assigneeIds: st.assigneeIds.filter((uid) => canSeeContainer(ctx.state, uid, targetListId)),
          version: st.version + 1,
          updatedAt: ctx.now,
        };
      }
    }
  }

  const sameSpot =
    !crossList && targetStatusId === task.statusId && (input.index === undefined || input.index === task.position);
  if (sameSpot && !task.parentTaskId) return ok({ value: { task, unassigned: [] }, patch: {} });

  let message: string | null = null;
  if (crossList) message = `moved “${task.title}” to ${ctx.state.containers[targetListId]?.name ?? 'another list'}`;
  else if (targetStatusId !== task.statusId) message = `moved “${task.title}” to ${ctx.state.statuses[targetStatusId]?.name}`;

  return ok({
    value: { task: tasks[id]!, unassigned },
    patch: {
      tasks,
      ...(message
        ? { activity: withActivity(ctx, { resourceId: targetListId, taskId: task.parentTaskId ?? id, message }) }
        : {}),
    },
  });
}

/** Hard delete (with UI confirmation). Deletes subtasks and closes the gap in the column. */
export function deleteTask(ctx: CommandContext, id: ID): CommandResult<{ deleted: ID[] }> {
  const res = requireTask(ctx, id);
  if (res.error) return res;
  const task = res.data;
  const tasks = { ...ctx.state.tasks };
  const deleted = [id, ...subtasksOf(tasks, id).map((t) => t.id)];
  for (const d of deleted) delete tasks[d];

  if (task.parentTaskId) renumber(tasks, subtasksOf(tasks, task.parentTaskId), ctx.now);
  else renumber(tasks, columnTasks(tasks, task.primaryListId, task.statusId), ctx.now);

  return ok({
    value: { deleted },
    patch: {
      tasks,
      activity: withActivity(ctx, { resourceId: task.primaryListId, taskId: null, message: `deleted “${task.title}”` }),
    },
  });
}
