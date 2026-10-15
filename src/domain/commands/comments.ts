import type { Comment, ID } from '../types';
import { fail, ok } from '../result';
import { isAdmin, requireTaskEditAccess } from '../permissions';
import { validateCommentBody } from '../validation';
import { withActivity, type CommandContext, type CommandResult } from './context';

/** Anyone who can work on the task's list can comment on it. */
export function addComment(ctx: CommandContext, taskId: ID, body: string): CommandResult<Comment> {
  const task = ctx.state.tasks[taskId];
  if (!task) return fail('NOT_FOUND', 'This task no longer exists.');
  const access = requireTaskEditAccess(ctx.state, ctx.actorId, task.primaryListId);
  if (access.error) return access;
  const text = validateCommentBody(body);
  if (text.error) return text;

  const comment: Comment = { id: ctx.newId('cm'), taskId, authorId: ctx.actorId, body: text.data, createdAt: ctx.now, editedAt: null };
  return ok({
    value: comment,
    patch: {
      comments: { ...ctx.state.comments, [comment.id]: comment },
      activity: withActivity(ctx, { resourceId: task.primaryListId, taskId: task.parentTaskId ?? taskId, message: `commented on “${task.title}”` }),
    },
  });
}

/** Authors edit their own comments. */
export function editComment(ctx: CommandContext, id: ID, body: string): CommandResult<Comment> {
  const comment = ctx.state.comments[id];
  if (!comment) return fail('NOT_FOUND', 'This comment no longer exists.');
  if (comment.authorId !== ctx.actorId) return fail('FORBIDDEN', 'You can only edit your own comments.');
  const text = validateCommentBody(body);
  if (text.error) return text;
  const next = { ...comment, body: text.data, editedAt: ctx.now };
  return ok({ value: next, patch: { comments: { ...ctx.state.comments, [id]: next } } });
}

/** Authors delete their own comments; admins can delete any. */
export function deleteComment(ctx: CommandContext, id: ID): CommandResult<{ deleted: ID }> {
  const comment = ctx.state.comments[id];
  if (!comment) return fail('NOT_FOUND', 'This comment no longer exists.');
  if (comment.authorId !== ctx.actorId && !isAdmin(ctx.state.users[ctx.actorId])) {
    return fail('FORBIDDEN', 'You can only delete your own comments.');
  }
  const comments = { ...ctx.state.comments };
  delete comments[id];
  return ok({ value: { deleted: id }, patch: { comments } });
}
