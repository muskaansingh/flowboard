import type { ActivityEntry, EntitiesState, ID } from '../types';
import type { Result } from '../result';

/**
 * Commands are pure functions: (context, args) → Result<{ patch, value }>.
 * They validate, enforce permissions, and compute the next entity state, but never touch
 * the store directly. The store applies `patch` only when the command succeeded, so a failed
 * command can never leave partial writes behind.
 */
export interface CommandContext {
  state: EntitiesState;
  actorId: ID;
  now: string;
  newId: (prefix: string) => string;
}

export interface CommandOutput<T> {
  patch: Partial<EntitiesState>;
  value: T;
}

export type CommandResult<T> = Result<CommandOutput<T>>;

const ACTIVITY_LIMIT = 200;

export function withActivity(
  ctx: CommandContext,
  entry: Omit<ActivityEntry, 'id' | 'at' | 'actorId'>,
  base: ActivityEntry[] = ctx.state.activity,
): ActivityEntry[] {
  const next: ActivityEntry = { ...entry, id: ctx.newId('ac'), at: ctx.now, actorId: ctx.actorId };
  return [next, ...base].slice(0, ACTIVITY_LIMIT);
}

let counter = 0;
export function defaultIdFactory(prefix: string): string {
  counter += 1;
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}${counter.toString(36)}`;
}
