import type { Container, EntitiesState, Grant, Priority, Status, StatusCategory, StatusColor, Task, User } from '@/domain/types';

/**
 * Seed fixtures: 1 workspace, 2 spaces, 2 folders, 3 lists, 20 tasks (incl. subtasks), 3 users, 3 grants.
 *
 * Resulting visibility:
 *   Alice (admin) — everything
 *   Bob           — Engineering › Q2 Launch › Backlog + Sprint 14 (private, allow-granted)
 *   Carol         — Engineering › Q2 Launch (Backlog denied, Sprint 14 private) + Marketing (private, allow-granted)
 */

export const IDS = {
  workspace: 'ws_acme',
  spaceEng: 'sp_eng',
  spaceMkt: 'sp_mkt',
  folderQ2: 'fd_q2',
  folderCampaigns: 'fd_campaigns',
  listBacklog: 'ls_backlog',
  listSprint: 'ls_sprint',
  listLaunch: 'ls_launch',
  alice: 'u_alice',
  bob: 'u_bob',
  carol: 'u_carol',
} as const;

const DAY = 86_400_000;

export function createSeed(now: Date = new Date()): EntitiesState {
  const iso = (offsetDays = 0, hour = 17) => {
    const d = new Date(now.getTime() + offsetDays * DAY);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const created = iso(-14, 9);

  const users: User[] = [
    { id: IDS.alice, name: 'Alice Chen', email: 'alice@acme.dev', role: 'admin', avatarColor: 'violet' },
    { id: IDS.bob, name: 'Bob Martins', email: 'bob@acme.dev', role: 'member', avatarColor: 'sky' },
    { id: IDS.carol, name: 'Carol Diaz', email: 'carol@acme.dev', role: 'member', avatarColor: 'emerald' },
  ];

  const c = (
    id: string,
    name: string,
    type: Container['type'],
    parentId: string | null,
    position: number,
    visibility: Container['visibility'] = 'public',
  ): Container => ({ id, name, type, parentId, position, visibility, archivedAt: null, createdAt: created, updatedAt: created });

  const containers: Container[] = [
    c(IDS.workspace, 'Acme Inc.', 'workspace', null, 0),
    c(IDS.spaceEng, 'Engineering', 'space', IDS.workspace, 0),
    c(IDS.spaceMkt, 'Marketing', 'space', IDS.workspace, 1, 'private'),
    c(IDS.folderQ2, 'Q2 Launch', 'folder', IDS.spaceEng, 0),
    c(IDS.folderCampaigns, 'Campaigns', 'folder', IDS.spaceMkt, 0),
    c(IDS.listBacklog, 'Backlog', 'list', IDS.folderQ2, 0),
    c(IDS.listSprint, 'Sprint 14', 'list', IDS.folderQ2, 1, 'private'),
    c(IDS.listLaunch, 'Launch Campaign', 'list', IDS.folderCampaigns, 0),
  ];

  const grants: Grant[] = [
    { id: 'gr_1', resourceId: IDS.listSprint, userId: IDS.bob, mode: 'allow' },
    { id: 'gr_2', resourceId: IDS.spaceMkt, userId: IDS.carol, mode: 'allow' },
    { id: 'gr_3', resourceId: IDS.listBacklog, userId: IDS.carol, mode: 'deny' },
  ];

  const statusDefs: Record<string, [string, StatusCategory, StatusColor][]> = {
    [IDS.listBacklog]: [
      ['To do', 'todo', 'slate'],
      ['In progress', 'in_progress', 'blue'],
      ['In review', 'in_progress', 'violet'],
      ['Done', 'done', 'green'],
    ],
    [IDS.listSprint]: [
      ['To do', 'todo', 'slate'],
      ['In progress', 'in_progress', 'blue'],
      ['Blocked', 'in_progress', 'rose'],
      ['Done', 'done', 'green'],
    ],
    [IDS.listLaunch]: [
      ['Ideas', 'todo', 'amber'],
      ['Drafting', 'in_progress', 'blue'],
      ['Published', 'done', 'green'],
    ],
  };
  const statuses: Status[] = [];
  for (const [listId, defs] of Object.entries(statusDefs)) {
    defs.forEach(([name, category, color], position) => {
      statuses.push({ id: `st_${listId.slice(3)}_${position}`, listId, name, category, color, position });
    });
  }
  const st = (listId: string, idx: number) => `st_${listId.slice(3)}_${idx}`;

  type T = [title: string, statusIdx: number, priority: Priority, assignees: string[], due: number | null, desc?: string];
  const taskDefs: Record<string, T[]> = {
    [IDS.listBacklog]: [
      ['Design onboarding checklist', 0, 'high', [IDS.bob], 5, 'Three-step checklist shown after first login. Needs copy review.'],
      ['Audit bundle size of the dashboard', 0, 'normal', [], 12],
      ['Add SSO via Google Workspace', 0, 'low', [IDS.alice], null],
      ['Migrate settings page to new form components', 1, 'normal', [IDS.bob], 3],
      ['Rate-limit public search endpoint', 1, 'urgent', [IDS.alice, IDS.bob], -1, 'Spike in scraping traffic last week — cap at 30 req/min per IP.'],
      ['Write ADR for event bus', 2, 'normal', [IDS.alice], 2],
      ['Upgrade to React 18 concurrent rendering', 3, 'high', [IDS.bob], -4],
      ['Fix flaky checkout E2E test', 3, 'normal', [], -6],
    ],
    [IDS.listSprint]: [
      ['Kanban drag-and-drop polish', 0, 'high', [IDS.bob], 4, 'Drop indicator, auto-scroll and keyboard support.'],
      ['Permission-aware sidebar tree', 1, 'urgent', [IDS.alice, IDS.bob], 1],
      ['Task detail drawer', 1, 'normal', [IDS.bob], 6],
      ['Waiting on design tokens from brand team', 2, 'normal', [IDS.alice], 0],
      ['Seed fixtures for demo workspace', 3, 'low', [IDS.bob], -2],
    ],
    [IDS.listLaunch]: [
      ['Launch blog post', 1, 'high', [IDS.carol], 7, 'Story: why we built Flowboard. ~1200 words.'],
      ['Product Hunt listing', 0, 'normal', [IDS.carol], 14],
      ['Customer quote collection', 0, 'low', [], null],
      ['Newsletter announcement', 1, 'normal', [IDS.alice, IDS.carol], 9],
      ['Teaser video', 2, 'urgent', [IDS.carol], -3],
    ],
  };

  const tasks: Task[] = [];
  let n = 1;
  for (const [listId, defs] of Object.entries(taskDefs)) {
    const colCount = new Map<number, number>();
    for (const [title, statusIdx, priority, assigneeIds, due, description] of defs) {
      const position = colCount.get(statusIdx) ?? 0;
      colCount.set(statusIdx, position + 1);
      tasks.push({
        id: `tk_${n++}`,
        title,
        description: description ?? '',
        statusId: st(listId, statusIdx),
        priority,
        assigneeIds,
        dueDate: due === null ? null : iso(due),
        position,
        primaryListId: listId,
        parentTaskId: null,
        version: 1,
        createdAt: created,
        updatedAt: created,
      });
    }
  }

  // Subtasks (one level deep) on "Launch blog post" (tk_14) and "Kanban drag-and-drop polish" (tk_9).
  const sub = (parentId: string, listId: string, title: string, statusIdx: number, position: number): Task => ({
    id: `tk_${n++}`,
    title,
    description: '',
    statusId: st(listId, statusIdx),
    priority: 'none',
    assigneeIds: [],
    dueDate: null,
    position,
    primaryListId: listId,
    parentTaskId: parentId,
    version: 1,
    createdAt: created,
    updatedAt: created,
  });
  tasks.push(
    sub('tk_14', IDS.listLaunch, 'Outline', 2, 0),
    sub('tk_14', IDS.listLaunch, 'First draft', 1, 1),
    sub('tk_9', IDS.listSprint, 'Drop-target highlight', 3, 0),
  );

  const byId = <X extends { id: string }>(xs: X[]) => Object.fromEntries(xs.map((x) => [x.id, x])) as Record<string, X>;
  return {
    users: byId(users),
    containers: byId(containers),
    grants: byId(grants),
    statuses: byId(statuses),
    tasks: byId(tasks),
    activity: [],
  };
}
