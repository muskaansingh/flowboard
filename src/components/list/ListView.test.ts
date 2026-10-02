import { describe, expect, it } from 'vitest';
import { sortTasks } from './ListView';
import { createSeed, IDS } from '@/data/seed';

const seed = createSeed(new Date('2026-06-01T10:00:00Z'));
const tasks = Object.values(seed.tasks).filter((t) => t.primaryListId === IDS.listBacklog && !t.parentTaskId);
const order = new Map(Object.values(seed.statuses).filter((s) => s.listId === IDS.listBacklog).map((s) => [s.id, s.position]));

describe('sortTasks', () => {
  it('priority asc puts urgent first and "none" last', () => {
    const sorted = sortTasks(tasks, { key: 'priority', dir: 'asc' }, order).map((t) => t.priority);
    expect(sorted[0]).toBe('urgent');
    expect(sorted).toEqual([...sorted].sort((a, b) => ['urgent', 'high', 'normal', 'low', 'none'].indexOf(a) - ['urgent', 'high', 'normal', 'low', 'none'].indexOf(b)));
  });

  it('due date sorts both directions and always sinks tasks without a date', () => {
    const asc = sortTasks(tasks, { key: 'dueDate', dir: 'asc' }, order);
    const desc = sortTasks(tasks, { key: 'dueDate', dir: 'desc' }, order);
    expect(asc.at(-1)!.dueDate).toBeNull();
    expect(desc.at(-1)!.dueDate).toBeNull();
    const ascDates = asc.filter((t) => t.dueDate).map((t) => Date.parse(t.dueDate!));
    expect(ascDates).toEqual([...ascDates].sort((a, b) => a - b));
  });

  it('manual order follows board order (status, then position)', () => {
    const sorted = sortTasks(tasks, { key: 'manual', dir: 'asc' }, order);
    expect(sorted[0]!.title).toBe('Design onboarding checklist');
    expect(sorted.at(-1)!.title).toBe('Fix flaky checkout E2E test');
  });
});
