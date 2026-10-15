import type { Container, ID, Task } from './types';

/**
 * Jira-style project key from a list name: initials for multi-word names ("Launch Campaign" → LC),
 * otherwise the first three letters ("Sprint 14" → SPR, "Backlog" → BAC).
 */
export function listPrefix(name: string): string {
  const words = name.match(/[A-Za-z]+/g) ?? [];
  if (words.length === 0) return 'TSK';
  const key = words.length >= 2 ? words.slice(0, 3).map((w) => w[0]).join('') : words[0]!.slice(0, 3);
  return key.toUpperCase();
}

export function taskKey(task: Pick<Task, 'number' | 'primaryListId'>, containers: Record<ID, Container>): string {
  return `${listPrefix(containers[task.primaryListId]?.name ?? '')}-${task.number}`;
}
