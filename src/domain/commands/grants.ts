import type { Grant, GrantMode, ID } from '../types';
import { fail, ok } from '../result';
import { findGrant, isAdmin, requireAdmin, requireContainer } from '../permissions';
import type { CommandContext, CommandResult } from './context';

/**
 * Sets (or clears, with `mode: null`) a user's grant on a space, folder or list.
 * One grant per (resource, user) pair — setting a new mode replaces the old one.
 */
export function setGrant(
  ctx: CommandContext,
  resourceId: ID,
  userId: ID,
  mode: GrantMode | null,
): CommandResult<Grant | null> {
  const admin = requireAdmin(ctx.state, ctx.actorId, 'change sharing');
  if (admin.error) return admin;
  const res = requireContainer(ctx.state, ctx.actorId, resourceId);
  if (res.error) return res;
  if (res.data.type === 'workspace') return fail('VALIDATION', 'Grants attach to spaces, folders or lists.');

  const target = ctx.state.users[userId];
  if (!target) return fail('NOT_FOUND', 'Unknown user.');
  if (isAdmin(target)) return fail('VALIDATION', `${target.name} is an admin and always has access.`);
  if (mode !== null && mode !== 'allow' && mode !== 'deny') return fail('VALIDATION', 'Grant mode must be allow or deny.');

  const existing = findGrant(ctx.state, resourceId, userId);
  const grants = { ...ctx.state.grants };
  if (existing) delete grants[existing.id];
  if (mode === null) return ok({ value: null, patch: { grants } });

  const grant: Grant = { id: existing?.id ?? ctx.newId('gr'), resourceId, userId, mode };
  grants[grant.id] = grant;
  return ok({ value: grant, patch: { grants } });
}
