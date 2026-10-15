import { describe, expect, it } from 'vitest';
import type { Status, Task } from '@/domain/types';
import type { ListViewModel } from '@/store/selectors';
import { EMPTY_FILTER, UNASSIGNED } from '@/store/uiStore';
import { filterCount, filterListView } from './ListPage';

const now = new Date(2026, 9, 15, 12);
const day = (offset: number) => new Date(2026, 9, 15 + offset, 17).toISOString();
const st = (id: string, category: Status['category']) => ({ id, name: id, category, color: 'slate', listId: 'l', position: 0 }) as Status;
const task = (id: string, p: Partial<Task>) =>
  ({ id, title: id, description: '', statusId: 'todo', priority: 'normal', assigneeIds: [], dueDate: null, position: 0, ...p }) as Task;

const tasks = [
  task('a', { assigneeIds: ['u1'], priority: 'urgent', dueDate: day(-2) }),
  task('b', { assigneeIds: ['u2'], statusId: 'done', dueDate: day(-3) }),
  task('c', { priority: 'low', dueDate: day(0) }),
  task('d', { assigneeIds: ['u1', 'u2'], statusId: 'doing', dueDate: day(5) }),
  task('e', {}),
];
const vm = {
  statuses: [st('todo', 'todo'), st('doing', 'in_progress'), st('done', 'done')],
  tasks,
  columns: { todo: tasks.filter((t) => t.statusId === 'todo'), doing: [tasks[3]], done: [tasks[1]] },
} as unknown as ListViewModel;

const ids = (f: Partial<typeof EMPTY_FILTER>) => filterListView(vm, { ...EMPTY_FILTER, ...f }, 'u1', now).tasks.map((t) => t.id);

describe('filterListView', () => {
  it('returns the same view model when nothing is filtered', () => {
    expect(filterListView(vm, EMPTY_FILTER, 'u1', now)).toBe(vm);
    expect(filterCount(EMPTY_FILTER)).toBe(0);
  });

  it('ORs values within a field and ANDs across fields', () => {
    expect(ids({ assigneeIds: ['u1', UNASSIGNED] })).toEqual(['a', 'c', 'd', 'e']);
    expect(ids({ assigneeIds: ['u1'], priorities: ['urgent'] })).toEqual(['a']);
  });

  it('status filter narrows tasks and board columns', () => {
    const out = filterListView(vm, { ...EMPTY_FILTER, statusIds: ['doing'] }, 'u1', now);
    expect(out.tasks.map((t) => t.id)).toEqual(['d']);
    expect(out.statuses.map((s) => s.id)).toEqual(['doing']);
  });

  it('due buckets ignore done tasks for date windows', () => {
    expect(ids({ due: ['overdue'] })).toEqual(['a']);
    expect(ids({ due: ['today'] })).toEqual(['c']);
    expect(ids({ due: ['week'] })).toEqual(['c', 'd']);
    expect(ids({ due: ['none'] })).toEqual(['e']);
  });
});
