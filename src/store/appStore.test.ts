import { describe, expect, it } from 'vitest';
import { flattenTree, IDS, makeStore } from '@/test/factory';
import { selectActivity, selectListView, selectSearch, selectTaskDetail, selectVisibleTree } from './selectors';
import { columnTasks } from '@/domain/commands/tasks';

const st = (list: string, idx: number) => `st_${list.slice(3)}_${idx}`;

const columnTitles = (store: ReturnType<typeof makeStore>, listId: string, statusId: string) =>
  columnTasks(store.getState().tasks, listId, statusId).map((t) => `${t.position}:${t.title}`);

describe('store · permission-filtered reads', () => {
  it('switching user immediately changes the visible tree', () => {
    const store = makeStore();
    expect(flattenTree(selectVisibleTree(store.getState()))).toContain('space:Marketing');
    store.getState().switchUser(IDS.bob);
    expect(flattenTree(selectVisibleTree(store.getState()))).not.toContain('space:Marketing');
  });

  it('opening a denied list returns a FORBIDDEN error (client-side 403)', () => {
    const store = makeStore(IDS.bob);
    const res = selectListView(store.getState(), IDS.listLaunch);
    expect(res.error).toEqual({ code: 'FORBIDDEN', message: expect.stringMatching(/access/) });
  });

  it('task detail for a task in a hidden list is FORBIDDEN', () => {
    const store = makeStore(IDS.carol);
    expect(selectTaskDetail(store.getState(), 'tk_1').error?.code).toBe('FORBIDDEN');
    expect(selectTaskDetail(store.getState(), 'tk_14').data?.task.title).toBe('Launch blog post');
  });

  it('search only returns tasks from visible lists', () => {
    const store = makeStore(IDS.carol);
    const hits = selectSearch(store.getState(), 'launch');
    expect(hits.map((h) => h.list.id)).toEqual(expect.arrayContaining([IDS.listLaunch]));
    expect(hits.every((h) => h.list.id === IDS.listLaunch)).toBe(true);
  });

  it('activity feed hides events from lists the viewer cannot see', () => {
    const store = makeStore(IDS.alice);
    store.getState().createTask(IDS.listLaunch, { title: 'Secret marketing task' });
    store.getState().createTask(IDS.listBacklog, { title: 'Public eng task' });
    store.getState().switchUser(IDS.bob);
    const messages = selectActivity(store.getState()).map((a) => a.message);
    expect(messages).toEqual(['created “Public eng task”']);
  });
});

describe('store · task access enforcement', () => {
  it('member can edit tasks in lists they can see', () => {
    const store = makeStore(IDS.bob);
    const res = store.getState().updateTask('tk_9', { title: 'Renamed by Bob' });
    expect(res.error).toBeUndefined();
    expect(store.getState().tasks.tk_9!.title).toBe('Renamed by Bob');
  });

  it('member cannot read, mutate, move into, or delete tasks in hidden lists — and nothing is written', () => {
    const store = makeStore(IDS.carol);
    const before = store.getState().tasks;
    expect(store.getState().updateTask('tk_9', { title: 'x' }).error?.code).toBe('FORBIDDEN');
    expect(store.getState().deleteTask('tk_1').error?.code).toBe('FORBIDDEN');
    expect(store.getState().createTask(IDS.listSprint, { title: 'x' }).error?.code).toBe('FORBIDDEN');
    expect(store.getState().moveTask('tk_14', { listId: IDS.listBacklog }).error?.code).toBe('FORBIDDEN');
    expect(store.getState().tasks).toBe(before);
  });

  it('members cannot change structure (containers, statuses, sharing)', () => {
    const store = makeStore(IDS.bob);
    const s = store.getState();
    expect(s.createContainer({ parentId: IDS.folderQ2, name: 'New' }).error?.code).toBe('FORBIDDEN');
    expect(s.renameContainer(IDS.listBacklog, 'x').error?.code).toBe('FORBIDDEN');
    expect(s.archiveContainer(IDS.listBacklog).error?.code).toBe('FORBIDDEN');
    expect(s.setGrant(IDS.listBacklog, IDS.carol, 'allow').error?.code).toBe('FORBIDDEN');
    expect(s.createStatus(IDS.listBacklog, { name: 'QA', category: 'in_progress', color: 'teal' }).error?.code).toBe('FORBIDDEN');
  });

  it('grant changes take effect immediately for the affected user', () => {
    const store = makeStore(IDS.alice);
    expect(store.getState().setGrant(IDS.spaceMkt, IDS.bob, 'allow').error).toBeUndefined();
    store.getState().switchUser(IDS.bob);
    expect(flattenTree(selectVisibleTree(store.getState()))).toContain('list:Launch Campaign');
    store.getState().switchUser(IDS.alice);
    store.getState().setGrant(IDS.spaceMkt, IDS.bob, null);
    store.getState().switchUser(IDS.bob);
    expect(flattenTree(selectVisibleTree(store.getState()))).not.toContain('space:Marketing');
  });
});

describe('store · task validation & integrity', () => {
  it('rejects empty and >500 char titles', () => {
    const store = makeStore();
    expect(store.getState().createTask(IDS.listBacklog, { title: '   ' }).error?.code).toBe('VALIDATION');
    const long = store.getState().createTask(IDS.listBacklog, { title: 'a'.repeat(501) });
    expect(long.error?.fields?.title).toMatch(/500/);
    expect(store.getState().createTask(IDS.listBacklog, { title: 'a'.repeat(500) }).error).toBeUndefined();
  });

  it('rejects a status that belongs to another list', () => {
    const store = makeStore();
    const res = store.getState().createTask(IDS.listBacklog, { title: 'x', statusId: st(IDS.listLaunch, 0) });
    expect(res.error?.code).toBe('VALIDATION');
    expect(store.getState().updateTask('tk_1', { statusId: st(IDS.listSprint, 1) }).error?.code).toBe('VALIDATION');
  });

  it('rejects assignees who cannot access the list', () => {
    const store = makeStore();
    const res = store.getState().updateTask('tk_1', { assigneeIds: [IDS.carol] });
    expect(res.error?.code).toBe('VALIDATION');
    expect(res.error?.message).toMatch(/Carol/);
  });

  it('rejects invalid due dates and priorities', () => {
    const store = makeStore();
    expect(store.getState().updateTask('tk_1', { dueDate: 'next tuesday' }).error?.code).toBe('VALIDATION');
    // @ts-expect-error — runtime guard against bad payloads
    expect(store.getState().updateTask('tk_1', { priority: 'critical' }).error?.code).toBe('VALIDATION');
  });

  it('detects stale edits via version (optimistic concurrency)', () => {
    const store = makeStore();
    const v = store.getState().tasks.tk_1!.version;
    store.getState().updateTask('tk_1', { title: 'First edit' });
    const res = store.getState().updateTask('tk_1', { title: 'Stale edit' }, { expectedVersion: v });
    expect(res.error?.code).toBe('CONFLICT');
    expect(store.getState().tasks.tk_1!.title).toBe('First edit');
  });

  it('allows one level of subtasks only', () => {
    const store = makeStore();
    const child = store.getState().createTask(IDS.listBacklog, { title: 'child', parentTaskId: 'tk_1' });
    expect(child.data?.parentTaskId).toBe('tk_1');
    const grandchild = store.getState().createTask(IDS.listBacklog, { title: 'grandchild', parentTaskId: child.data!.id });
    expect(grandchild.error?.code).toBe('INVALID_PARENT');
    const crossList = store.getState().createTask(IDS.listSprint, { title: 'x', parentTaskId: 'tk_1' });
    expect(crossList.error?.code).toBe('INVALID_PARENT');
  });

  it('deleting a task removes its subtasks and closes the position gap', () => {
    const store = makeStore();
    store.getState().deleteTask('tk_14');
    expect(store.getState().tasks.tk_19).toBeUndefined();
    expect(store.getState().tasks.tk_20).toBeUndefined();
    expect(columnTitles(store, IDS.listLaunch, st(IDS.listLaunch, 1))).toEqual(['0:Newsletter announcement']);
  });
});

describe('store · moving & ordering tasks', () => {
  it('reorders within a column with contiguous positions', () => {
    const store = makeStore();
    const col = st(IDS.listBacklog, 0);
    store.getState().moveTask('tk_3', { statusId: col, index: 0 });
    expect(columnTitles(store, IDS.listBacklog, col)).toEqual([
      '0:Add SSO via Google Workspace',
      '1:Design onboarding checklist',
      '2:Audit bundle size of the dashboard',
    ]);
  });

  it('dragging to another column changes status and renumbers both columns', () => {
    const store = makeStore();
    const todo = st(IDS.listBacklog, 0);
    const done = st(IDS.listBacklog, 3);
    store.getState().moveTask('tk_1', { statusId: done, index: 1 });
    expect(store.getState().tasks.tk_1!.statusId).toBe(done);
    expect(columnTitles(store, IDS.listBacklog, todo)).toEqual(['0:Audit bundle size of the dashboard', '1:Add SSO via Google Workspace']);
    expect(columnTitles(store, IDS.listBacklog, done)).toEqual([
      '0:Upgrade to React 18 concurrent rendering',
      '1:Design onboarding checklist',
      '2:Fix flaky checkout E2E test',
    ]);
  });

  it('moving to another list maps status by category, carries subtasks, and unassigns users without access', () => {
    const store = makeStore();
    // "Newsletter announcement" (tk_17) is in progress, assigned to Alice + Carol. Carol can't see Sprint 14.
    const res = store.getState().moveTask('tk_17', { listId: IDS.listSprint });
    expect(res.data?.unassigned).toEqual([IDS.carol]);
    const moved = store.getState().tasks.tk_17!;
    expect(moved.primaryListId).toBe(IDS.listSprint);
    expect(store.getState().statuses[moved.statusId]!.category).toBe('in_progress');
    expect(moved.assigneeIds).toEqual([IDS.alice]);

    store.getState().moveTask('tk_14', { listId: IDS.listBacklog });
    expect(store.getState().tasks.tk_19!.primaryListId).toBe(IDS.listBacklog);
    expect(store.getState().statuses[store.getState().tasks.tk_19!.statusId]!.listId).toBe(IDS.listBacklog);
  });

  it('subtasks cannot be moved to another list on their own', () => {
    const store = makeStore();
    expect(store.getState().moveTask('tk_19', { listId: IDS.listBacklog }).error?.code).toBe('INVALID_PARENT');
  });

  it('rejects moves to a status from a different list', () => {
    const store = makeStore();
    expect(store.getState().moveTask('tk_1', { statusId: st(IDS.listSprint, 0) }).error?.code).toBe('VALIDATION');
  });
});

describe('store · containers', () => {
  it('enforces the workspace → space → folder → list hierarchy', () => {
    const store = makeStore();
    const s = store.getState();
    expect(s.createContainer({ parentId: IDS.listBacklog, name: 'Nope' }).error?.code).toBe('INVALID_PARENT');
    expect(s.createContainer({ parentId: IDS.spaceEng, name: 'Nope', type: 'list' }).error?.code).toBe('INVALID_PARENT');
    const folder = s.createContainer({ parentId: IDS.spaceEng, name: 'Q3 Planning' });
    expect(folder.data?.type).toBe('folder');
    expect(folder.data?.position).toBe(1);
  });

  it('new lists get the default todo / in progress / done status set', () => {
    const store = makeStore();
    const list = store.getState().createContainer({ parentId: IDS.folderQ2, name: 'Bugs' }).data!;
    const view = selectListView(store.getState(), list.id).data!;
    expect(view.statuses.map((s) => s.category)).toEqual(['todo', 'in_progress', 'done']);
  });

  it('rejects duplicate sibling names (case-insensitive)', () => {
    const store = makeStore();
    expect(store.getState().createContainer({ parentId: IDS.folderQ2, name: 'backlog' }).error?.code).toBe('CONFLICT');
    expect(store.getState().renameContainer(IDS.listSprint, 'BACKLOG').error?.code).toBe('CONFLICT');
  });

  it('reorders siblings', () => {
    const store = makeStore();
    store.getState().reorderContainer(IDS.spaceMkt, 0);
    expect(flattenTree(selectVisibleTree(store.getState()))[1]).toBe('space:Marketing');
    expect(store.getState().containers[IDS.spaceEng]!.position).toBe(1);
  });

  it('archiving hides the subtree and its tasks; restore brings them back', () => {
    const store = makeStore();
    store.getState().archiveContainer(IDS.folderQ2);
    expect(flattenTree(selectVisibleTree(store.getState()))).not.toContain('list:Backlog');
    expect(selectListView(store.getState(), IDS.listBacklog).error?.code).toBe('NOT_FOUND');
    expect(store.getState().updateTask('tk_1', { title: 'x' }).error?.code).toBe('NOT_FOUND');
    expect(selectSearch(store.getState(), 'onboarding')).toHaveLength(0);

    expect(store.getState().restoreContainer(IDS.folderQ2).error).toBeUndefined();
    expect(selectListView(store.getState(), IDS.listBacklog).data?.tasks.length).toBe(8);
  });

  it('cannot restore a child while its parent is archived', () => {
    const store = makeStore();
    store.getState().archiveContainer(IDS.listBacklog);
    store.getState().archiveContainer(IDS.folderQ2);
    expect(store.getState().restoreContainer(IDS.listBacklog).error?.code).toBe('INVALID_PARENT');
  });
});

describe('store · statuses', () => {
  it('deleting a status with tasks requires a reassignment target in the same list', () => {
    const store = makeStore();
    const review = st(IDS.listBacklog, 2);
    expect(store.getState().deleteStatus(review).error?.code).toBe('VALIDATION');
    expect(store.getState().deleteStatus(review, st(IDS.listSprint, 1)).error?.code).toBe('VALIDATION');
    const res = store.getState().deleteStatus(review, st(IDS.listBacklog, 1));
    expect(res.data?.moved).toBe(1);
    expect(store.getState().tasks.tk_6!.statusId).toBe(st(IDS.listBacklog, 1));
    expect(columnTitles(store, IDS.listBacklog, st(IDS.listBacklog, 1))).toHaveLength(3);
  });

  it('keeps at least one status per category', () => {
    const store = makeStore();
    expect(store.getState().deleteStatus(st(IDS.listBacklog, 3)).error?.message).toMatch(/at least one/);
    expect(store.getState().updateStatus(st(IDS.listBacklog, 0), { category: 'done' }).error?.code).toBe('VALIDATION');
  });
});
