import { Fragment, useRef, useState, type ReactNode } from 'react';
import type { ActivityEntry, Comment, ID, User } from '@/domain/types';
import { useAppStore } from '@/store/appStore';
import { notify } from '@/store/toastStore';
import { Avatar, Button, FieldError, timeAgo } from '@/components/ui/primitives';
import { cx } from '@/ui/tokens';

/** Highlights `@First Last` mentions of known users. */
function renderBody(body: string, users: User[]): ReactNode {
  const names = users.map((u) => u.name).sort((a, b) => b.length - a.length);
  if (!names.length) return body;
  const re = new RegExp(`@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  const parts = body.split(re);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="rounded bg-brand-50 px-0.5 font-medium text-brand-700">
        @{part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/** Textarea with @mention autocomplete. ⌘/Ctrl+Enter submits. */
function Composer({
  people,
  initial = '',
  submitLabel,
  onSubmit,
  onCancel,
  autoFocus,
}: {
  people: User[];
  initial?: string;
  submitLabel: string;
  onSubmit: (body: string) => boolean;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState(initial);
  const [focused, setFocused] = useState(!!autoFocus);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  const matches = mention ? people.filter((u) => u.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 5) : [];

  const detectMention = (text: string, caret: number) => {
    const m = /(^|\s)@([\w]*(?: [\w]*)?)$/.exec(text.slice(0, caret));
    setMention(m ? { start: caret - m[2]!.length - 1, query: m[2]! } : null);
    setActive(0);
  };

  const insert = (u: User) => {
    if (!mention || !ref.current) return;
    const caret = ref.current.selectionStart;
    const next = `${body.slice(0, mention.start)}@${u.name} ${body.slice(caret)}`;
    setBody(next);
    setMention(null);
    const pos = mention.start + u.name.length + 2;
    requestAnimationFrame(() => ref.current?.setSelectionRange(pos, pos));
  };

  const submit = () => {
    if (!body.trim()) return;
    if (onSubmit(body)) {
      setBody('');
      setMention(null);
      if (!onCancel) setFocused(false);
    }
  };

  const expanded = focused || !!body;

  return (
    <div className="relative min-w-0 flex-1">
      <textarea
        ref={ref}
        autoFocus={autoFocus}
        aria-label={submitLabel === 'Save' ? 'Edit comment' : 'Add a comment'}
        placeholder="Add a comment… use @ to mention someone"
        rows={expanded ? 3 : 1}
        value={body}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          setBody(e.target.value);
          detectMention(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(e) => {
          if (matches.length) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length);
              return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              insert(matches[active]!);
              return;
            }
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            if (mention) setMention(null);
            else if (onCancel) onCancel();
            else {
              setBody('');
              e.currentTarget.blur();
              setFocused(false);
            }
          }
        }}
        className="block w-full resize-y rounded-lg border-0 bg-surface px-3 py-2 text-sm text-ink ring-1 ring-inset ring-line-strong placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      {matches.length > 0 && (
        <ul role="listbox" aria-label="Mention someone" className="absolute left-2 top-full z-[70] mt-1 w-60 rounded-card bg-surface p-1 shadow-pop ring-1 ring-black/5">
          {matches.map((u, i) => (
            <li key={u.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(u)}
                className={cx('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-ink', i === active && 'bg-canvas')}
              >
                <Avatar user={u} size="xs" />
                {u.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {expanded && (
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" variant="primary" onClick={submit} disabled={!body.trim()}>
            {submitLabel}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (onCancel) return onCancel();
              setBody('');
              setFocused(false);
            }}
          >
            Cancel
          </Button>
          <span className="ml-auto text-2xs text-ink-subtle">⌘/Ctrl+Enter to send</span>
        </div>
      )}
    </div>
  );
}

function CommentItem({ comment, people, author, canDelete, isMine }: { comment: Comment; people: User[]; author?: User; canDelete: boolean; isMine: boolean }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="flex gap-3" data-testid="comment">
      {author ? <Avatar user={author} size="md" /> : <span className="h-8 w-8 rounded-full bg-line" />}
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          <span className="font-semibold text-ink">{author?.name ?? 'Former member'}</span>{' '}
          <span className="text-ink-subtle" title={new Date(comment.createdAt).toLocaleString()}>
            {timeAgo(comment.createdAt)}
            {comment.editedAt && ' · edited'}
          </span>
        </p>
        {editing ? (
          <div className="mt-1.5">
            <Composer
              people={people}
              initial={comment.body}
              submitLabel="Save"
              autoFocus
              onCancel={() => setEditing(false)}
              onSubmit={(body) => {
                const ok = notify(useAppStore.getState().editComment(comment.id, body));
                if (ok) setEditing(false);
                return ok;
              }}
            />
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{renderBody(comment.body, people)}</p>
        )}
        {!editing && (isMine || canDelete) && (
          <div className="mt-1 flex items-center gap-2 text-2xs font-medium text-ink-muted">
            {confirm ? (
              <>
                <span className="text-rose-700">Delete this comment?</span>
                <button type="button" className="text-rose-700 hover:underline" onClick={() => notify(useAppStore.getState().deleteComment(comment.id), 'Comment deleted')}>
                  Delete
                </button>
                <button type="button" className="hover:underline" onClick={() => setConfirm(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                {isMine && (
                  <button type="button" className="hover:text-ink hover:underline" onClick={() => setEditing(true)}>
                    Edit
                  </button>
                )}
                <button type="button" className="hover:text-ink hover:underline" onClick={() => setConfirm(true)}>
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** Jira's "Activity" section: Comments | History tabs. */
export function ActivitySection({ taskId, comments, history, people }: { taskId: ID; comments: Comment[]; history: ActivityEntry[]; people: User[] }) {
  const [tab, setTab] = useState<'comments' | 'history'>('comments');
  const users = useAppStore((s) => s.users);
  const me = useAppStore((s) => s.users[s.currentUserId]);
  const [error, setError] = useState<string>();

  return (
    <section aria-label="Activity">
      <div className="mb-3 flex items-center gap-3">
        <h3 className="text-sm font-semibold text-ink">Activity</h3>
        <div role="tablist" aria-label="Activity" className="inline-flex rounded-lg bg-black/5 p-0.5">
          {(
            [
              ['comments', `Comments${comments.length ? ` ${comments.length}` : ''}`],
              ['history', 'History'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cx(
                'h-6 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                tab === value ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'comments' ? (
        <>
          <div className="mb-4 flex gap-3">
            {me && <Avatar user={me} size="md" />}
            <div className="min-w-0 flex-1">
              <Composer
                people={people}
                submitLabel="Comment"
                onSubmit={(body) => {
                  const res = useAppStore.getState().addComment(taskId, body);
                  setError(res.error?.fields?.body ?? undefined);
                  return notify(res);
                }}
              />
              <FieldError message={error} />
            </div>
          </div>
          {comments.length === 0 ? (
            <p className="text-xs text-ink-subtle">No comments yet.</p>
          ) : (
            <ul className="space-y-4">
              {[...comments].reverse().map((c) => (
                <CommentItem
                  key={c.id}
                  comment={c}
                  people={people}
                  author={users[c.authorId]}
                  isMine={c.authorId === me?.id}
                  canDelete={c.authorId === me?.id || me?.role === 'admin'}
                />
              ))}
            </ul>
          )}
        </>
      ) : history.length === 0 ? (
        <p className="text-xs text-ink-subtle">No changes recorded in this session yet.</p>
      ) : (
        <ul className="space-y-3">
          {history.map((h) => {
            const actor = users[h.actorId];
            return (
              <li key={h.id} className="flex items-start gap-2.5 text-xs">
                {actor ? <Avatar user={actor} size="sm" /> : <span className="h-6 w-6 rounded-full bg-line" />}
                <p className="min-w-0 flex-1 pt-1 text-ink-muted">
                  <span className="font-semibold text-ink">{actor?.name ?? 'Someone'}</span> {h.message}
                  <span className="ml-1.5 text-ink-subtle" title={new Date(h.at).toLocaleString()}>
                    {timeAgo(h.at)}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
