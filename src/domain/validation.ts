import { PRIORITIES, STATUS_COLORS, TASK_TYPES, type Priority, type StatusColor, type TaskType } from './types';
import { fail, ok, type Result } from './result';

export const LIMITS = {
  taskTitle: 500,
  taskDescription: 10_000,
  containerName: 80,
  statusName: 32,
  comment: 5_000,
  label: 30,
  labelsPerTask: 10,
  points: 999,
} as const;

export function validateTaskType(raw: unknown): Result<TaskType> {
  if (raw === undefined) return ok('task');
  if (typeof raw === 'string' && (TASK_TYPES as readonly string[]).includes(raw)) return ok(raw as TaskType);
  return fail('VALIDATION', `Type must be one of: ${TASK_TYPES.join(', ')}.`, { type: 'Invalid type.' });
}

/** Story points: empty, or a number 0–999 with at most one decimal (0.5 is a common estimate). */
export function validatePoints(raw: unknown): Result<number | null> {
  if (raw === undefined || raw === null || raw === '') return ok(null);
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > LIMITS.points || Math.round(n * 10) !== n * 10) {
    return fail('VALIDATION', `Story points must be between 0 and ${LIMITS.points}.`, { points: `0–${LIMITS.points}, e.g. 3 or 0.5.` });
  }
  return ok(n);
}

/** Labels are normalised to lower-case-hyphenated, de-duplicated, and capped. */
export function normalizeLabel(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_.]/g, '');
}

export function validateLabels(raw: unknown): Result<string[]> {
  if (raw === undefined) return ok([]);
  if (!Array.isArray(raw)) return fail('VALIDATION', 'Labels must be a list.', { labels: 'Invalid labels.' });
  const labels = [...new Set(raw.filter((l): l is string => typeof l === 'string').map(normalizeLabel).filter(Boolean))];
  if (labels.some((l) => l.length > LIMITS.label)) {
    return fail('VALIDATION', `Labels must be ${LIMITS.label} characters or fewer.`, { labels: `Max ${LIMITS.label} characters each.` });
  }
  if (labels.length > LIMITS.labelsPerTask) {
    return fail('VALIDATION', `A task can have up to ${LIMITS.labelsPerTask} labels.`, { labels: `Max ${LIMITS.labelsPerTask} labels.` });
  }
  return ok(labels);
}

export function validateCommentBody(raw: unknown): Result<string> {
  if (typeof raw !== 'string' || !raw.trim()) return fail('VALIDATION', 'Comment can’t be empty.', { body: 'Write something first.' });
  const body = raw.trim();
  if (body.length > LIMITS.comment) {
    return fail('VALIDATION', `Comments must be ${LIMITS.comment} characters or fewer.`, { body: `Max ${LIMITS.comment} characters.` });
  }
  return ok(body);
}

export function validateName(raw: unknown, label: string, max: number): Result<string> {
  if (typeof raw !== 'string') return fail('VALIDATION', `${label} is required.`, { name: `${label} is required.` });
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) return fail('VALIDATION', `${label} is required.`, { name: `${label} is required.` });
  if (name.length > max) {
    return fail('VALIDATION', `${label} must be ${max} characters or fewer.`, { name: `Max ${max} characters.` });
  }
  return ok(name);
}

export function validateTitle(raw: unknown): Result<string> {
  if (typeof raw !== 'string' || !raw.trim()) {
    return fail('VALIDATION', 'Task title is required.', { title: 'Title is required.' });
  }
  const title = raw.trim();
  if (title.length > LIMITS.taskTitle) {
    return fail('VALIDATION', `Task title must be ${LIMITS.taskTitle} characters or fewer.`, {
      title: `Max ${LIMITS.taskTitle} characters (currently ${title.length}).`,
    });
  }
  return ok(title);
}

export function validateDescription(raw: unknown): Result<string> {
  if (raw === undefined || raw === null) return ok('');
  if (typeof raw !== 'string') return fail('VALIDATION', 'Description must be text.', { description: 'Must be text.' });
  if (raw.length > LIMITS.taskDescription) {
    return fail('VALIDATION', 'Description is too long.', { description: `Max ${LIMITS.taskDescription} characters.` });
  }
  return ok(raw);
}

export function validatePriority(raw: unknown): Result<Priority> {
  if (raw === undefined) return ok('none');
  if (typeof raw === 'string' && (PRIORITIES as readonly string[]).includes(raw)) return ok(raw as Priority);
  return fail('VALIDATION', `Priority must be one of: ${PRIORITIES.join(', ')}.`, { priority: 'Invalid priority.' });
}

export function validateStatusColor(raw: unknown): Result<StatusColor> {
  if (typeof raw === 'string' && (STATUS_COLORS as readonly string[]).includes(raw)) return ok(raw as StatusColor);
  return fail('VALIDATION', 'Unknown status colour.', { color: 'Invalid colour.' });
}

/** Accepts a full ISO-8601 datetime (or null to clear). Rejects unparsable strings. */
export function validateDueDate(raw: unknown): Result<string | null> {
  if (raw === undefined || raw === null || raw === '') return ok(null);
  if (typeof raw !== 'string') return fail('VALIDATION', 'Due date must be an ISO datetime.', { dueDate: 'Invalid date.' });
  const ms = Date.parse(raw);
  if (Number.isNaN(ms) || !/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return fail('VALIDATION', 'Due date must be an ISO datetime.', { dueDate: 'Invalid date.' });
  }
  return ok(new Date(ms).toISOString());
}
