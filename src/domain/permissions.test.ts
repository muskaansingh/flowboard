import { describe, expect, it } from 'vitest';
import { canSeeContainer, requireContainer } from './permissions';
import { buildVisibleTree, visibleListIds } from './tree';
import { createSeed, IDS } from '@/data/seed';
import { flattenTree } from '@/test/factory';
import type { EntitiesState } from './types';

const seed = () => createSeed(new Date('2026-06-01T10:00:00Z'));

function withGrant(state: EntitiesState, resourceId: string, userId: string, mode: 'allow' | 'deny'): EntitiesState {
  const id = `g_${resourceId}_${userId}`;
  return { ...state, grants: { ...state.grants, [id]: { id, resourceId, userId, mode } } };
}

describe('permission resolution', () => {
  it('admin sees the entire tree, including private containers', () => {
    const tree = flattenTree(buildVisibleTree(seed(), IDS.alice, IDS.workspace));
    expect(tree).toEqual([
      'workspace:Acme Inc.',
      'space:Engineering',
      'folder:Q2 Launch',
      'list:Backlog',
      'list:Sprint 14',
      'space:Marketing',
      'folder:Campaigns',
      'list:Launch Campaign',
    ]);
  });

  it('member sees public containers plus private ones they hold an allow grant on', () => {
    const tree = flattenTree(buildVisibleTree(seed(), IDS.bob, IDS.workspace));
    expect(tree).toEqual(['workspace:Acme Inc.', 'space:Engineering', 'folder:Q2 Launch', 'list:Backlog', 'list:Sprint 14']);
  });

  it('explicit deny hides an otherwise public container', () => {
    const tree = flattenTree(buildVisibleTree(seed(), IDS.carol, IDS.workspace));
    expect(tree).not.toContain('list:Backlog');
    expect(tree).toContain('list:Launch Campaign');
    expect(canSeeContainer(seed(), IDS.carol, IDS.listBacklog)).toBe(false);
  });

  it('private container without a grant is hidden from members', () => {
    expect(canSeeContainer(seed(), IDS.carol, IDS.listSprint)).toBe(false);
    expect(canSeeContainer(seed(), IDS.bob, IDS.spaceMkt)).toBe(false);
  });

  it('deny on an ancestor hides the entire subtree, even with allow on a descendant', () => {
    let s = withGrant(seed(), IDS.spaceEng, IDS.bob, 'deny');
    s = withGrant(s, IDS.listBacklog, IDS.bob, 'allow');
    expect(canSeeContainer(s, IDS.bob, IDS.folderQ2)).toBe(false);
    expect(canSeeContainer(s, IDS.bob, IDS.listBacklog)).toBe(false);
    expect(visibleListIds(s, IDS.bob).size).toBe(0);
  });

  it('deny takes precedence over public visibility; admins bypass deny', () => {
    const s = withGrant(seed(), IDS.spaceEng, IDS.alice, 'deny');
    expect(canSeeContainer(s, IDS.alice, IDS.listBacklog)).toBe(true);
  });

  it('requireContainer returns FORBIDDEN for hidden and NOT_FOUND for archived/missing nodes', () => {
    const s = seed();
    expect(requireContainer(s, IDS.bob, IDS.listLaunch).error?.code).toBe('FORBIDDEN');
    expect(requireContainer(s, IDS.bob, 'nope').error?.code).toBe('NOT_FOUND');

    const archived = { ...s, containers: { ...s.containers, [IDS.folderQ2]: { ...s.containers[IDS.folderQ2]!, archivedAt: '2026-06-01' } } };
    expect(requireContainer(archived, IDS.alice, IDS.listBacklog).error?.code).toBe('NOT_FOUND');
  });

  it('unknown users see nothing', () => {
    expect(canSeeContainer(seed(), 'u_ghost', IDS.workspace)).toBe(false);
    expect(buildVisibleTree(seed(), 'u_ghost', IDS.workspace)).toBeNull();
  });
});
