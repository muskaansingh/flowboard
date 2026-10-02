import { PRIORITIES, STATUS_COLORS, type Priority, type StatusColor } from './types';
import { fail, ok, type Result } from './result';

export const LIMITS = {
  taskTitle: 500,
  taskDescription: 10_000,
  containerName: 80,
  statusName: 32,
} as const;

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
