/**
 * Core domain models for Flowboard. These are plain serialisable objects —
 * the store holds them in normalised maps keyed by id.
 */

export type ID = string;
export type ISODateString = string;

export type ContainerType = 'workspace' | 'space' | 'folder' | 'list';
export type Visibility = 'public' | 'private';

export interface Container {
  id: ID;
  name: string;
  type: ContainerType;
  parentId: ID | null;
  /** Sibling ordering, contiguous 0..n-1 within a parent. */
  position: number;
  visibility: Visibility;
  /** Soft-delete marker. Archiving a node implicitly hides its whole subtree. */
  archivedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type StatusCategory = 'todo' | 'in_progress' | 'done';

export const STATUS_COLORS = ['slate', 'blue', 'amber', 'violet', 'green', 'rose', 'teal'] as const;
export type StatusColor = (typeof STATUS_COLORS)[number];

export interface Status {
  id: ID;
  listId: ID;
  name: string;
  category: StatusCategory;
  color: StatusColor;
  position: number;
}

export const PRIORITIES = ['urgent', 'high', 'normal', 'low', 'none'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TASK_TYPES = ['task', 'story', 'bug'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export interface Task {
  id: ID;
  /** Workspace-wide sequence number; the visible key is `<LIST PREFIX>-<number>` (e.g. SPR-12). */
  number: number;
  type: TaskType;
  /** Story-point estimate. */
  points: number | null;
  /** Lower-case, hyphenated tags. */
  labels: string[];
  title: string;
  description: string;
  statusId: ID;
  priority: Priority;
  assigneeIds: ID[];
  dueDate: ISODateString | null;
  /** Order within its (list, status) column. Contiguous 0..n-1. Subtasks are ordered among siblings. */
  position: number;
  primaryListId: ID;
  /** One level of subtasks only. */
  parentTaskId: ID | null;
  /** Monotonic counter used for optimistic-concurrency checks on edits. */
  version: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type Role = 'admin' | 'member';

export interface User {
  id: ID;
  name: string;
  email: string;
  role: Role;
  /** Tailwind palette key used for the avatar. */
  avatarColor: 'rose' | 'sky' | 'emerald' | 'amber' | 'violet';
}

export type GrantMode = 'allow' | 'deny';

export interface Grant {
  id: ID;
  resourceId: ID;
  userId: ID;
  mode: GrantMode;
}

export interface ActivityEntry {
  id: ID;
  actorId: ID;
  /** The list (or container) the event belongs to — used to permission-filter the feed. */
  resourceId: ID;
  taskId: ID | null;
  message: string;
  at: ISODateString;
}

export interface Comment {
  id: ID;
  taskId: ID;
  authorId: ID;
  /** Plain text; `@First Last` mentions are highlighted when rendered. */
  body: string;
  createdAt: ISODateString;
  editedAt: ISODateString | null;
}

export interface EntitiesState {
  containers: Record<ID, Container>;
  tasks: Record<ID, Task>;
  statuses: Record<ID, Status>;
  users: Record<ID, User>;
  grants: Record<ID, Grant>;
  activity: ActivityEntry[];
  comments: Record<ID, Comment>;
}

/** Valid child type for each container type. Lists hold tasks, not containers. */
export const CHILD_TYPE: Record<ContainerType, ContainerType | null> = {
  workspace: 'space',
  space: 'folder',
  folder: 'list',
  list: null,
};
