import { describe, expect, it } from 'vitest';
import { IDS, makeStore } from '@/test/factory';
import { selectSearch, selectTaskDetail } from './selectors';
import { migrateV1 } from './appStore';
import { listPrefix } from '@/domain/taskKey';
import { normalizeLabel, validatePoints } from '@/domain/validation';

describe('task keys & types', () => {
  it('derives Jira-style prefixes from list names', () => {
    expect(listPrefix('Sprint 14')).toBe('SPR');
    expect(listPrefix('Backlog')).toBe('BAC');
    expect(listPrefix('Launch Campaign')).toBe('LC');
    expect(listPrefix('123')).toBe('TSK');
  });

  it('new tasks get the next workspace-wide number and default to type "task"', () => {
    const store = makeStore();
    const max = Math.max(...Object.values(store.getState().tasks).map((t) => t.number));
    const res = store.getState().createTask(IDS.listSprint, { title: 'New thing' });
    expect(res.data?.number).toBe(max + 1);
    expect(res.data?.type).toBe('task');
    expect(selectTaskDetail(store.getState(), res.data!.id).data?.key).toBe(`SPR-${max + 1}`);
  });

  it('search matches an exact key and ranks it first', () => {
    const store = makeStore();
    const hits = selectSearch(store.getState(), 'spr-9');
    expect(hits[0]?.task.id).toBe('tk_9');
  });
});

describe('points & labels validation', () => {
  it('accepts empty, whole and half points; rejects negatives and junk', () => {
    expect(validatePoints('').data).toBeNull();
    expect(validatePoints(3).data).toBe(3);
    expect(validatePoints('0.5').data).toBe(0.5);
    expect(validatePoints(-1).error?.code).toBe('VALIDATION');
    expect(validatePoints('abc').error?.code).toBe('VALIDATION');
    expect(validatePoints(1.25).error?.code).toBe('VALIDATION');
  });

  it('normalises labels and de-duplicates on update', () => {
    expect(normalizeLabel('  Tech Debt! ')).toBe('tech-debt');
    const store = makeStore();
    const res = store.getState().updateTask('tk_1', { labels: ['UX', 'ux', 'New Label'] });
    expect(res.data?.labels).toEqual(['ux', 'new-label']);
  });
});

describe('comments', () => {
  it('members can comment on tasks they can access, not on hidden ones', () => {
    const store = makeStore(IDS.carol);
    expect(store.getState().addComment('tk_1', 'hi').error?.code).toBe('FORBIDDEN');
    const ok = store.getState().addComment('tk_14', '  Looks good  ');
    expect(ok.data?.body).toBe('Looks good');
    expect(selectTaskDetail(store.getState(), 'tk_14').data?.comments.map((c) => c.body)).toContain('Looks good');
  });

  it('only the author edits; author or admin deletes', () => {
    const store = makeStore(IDS.bob);
    const c = store.getState().addComment('tk_9', 'mine').data!;
    store.getState().switchUser(IDS.alice);
    expect(store.getState().editComment(c.id, 'hijack').error?.code).toBe('FORBIDDEN');
    expect(store.getState().deleteComment(c.id).data?.deleted).toBe(c.id); // admin may delete
  });

  it('rejects empty comments and removes comments with their task', () => {
    const store = makeStore();
    expect(store.getState().addComment('tk_9', '   ').error?.fields?.body).toBeTruthy();
    expect(Object.values(store.getState().comments).some((c) => c.taskId === 'tk_9')).toBe(true);
    store.getState().deleteTask('tk_9');
    expect(Object.values(store.getState().comments).some((c) => c.taskId === 'tk_9')).toBe(false);
  });
});

describe('undo', () => {
  it('restores a deleted task, and refuses if tasks changed since', () => {
    const store = makeStore();
    const before = store.getState().snapshot();
    store.getState().deleteTask('tk_9');
    const after = store.getState().tasks;
    expect(store.getState().undo(before, after).data).toBe(true);
    expect(store.getState().tasks.tk_9?.title).toBe('Kanban drag-and-drop polish');

    const snap = store.getState().snapshot();
    store.getState().deleteTask('tk_9');
    const afterDelete = store.getState().tasks;
    store.getState().updateTask('tk_1', { priority: 'low' }); // a later, unrelated change
    expect(store.getState().undo(snap, afterDelete).error?.code).toBe('CONFLICT');
  });
});

describe('storage migration v1 → v2', () => {
  it('keeps tasks and fills in number/type/points/labels + comments', () => {
    const out = migrateV1({
      tasks: {
        b: { id: 'b', title: 'B', createdAt: '2026-01-02T00:00:00Z' },
        a: { id: 'a', title: 'A', createdAt: '2026-01-01T00:00:00Z' },
      },
      currentUserId: 'u1',
    }) as { tasks: Record<string, { number: number; type: string; points: null; labels: string[] }>; comments: object };
    expect(out.tasks.a).toMatchObject({ number: 1, type: 'task', points: null, labels: [] });
    expect(out.tasks.b?.number).toBe(2);
    expect(out.comments).toEqual({});
  });
});
