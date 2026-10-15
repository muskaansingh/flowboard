import { forwardRef, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import type { Priority, Status, TaskType, User } from '@/domain/types';
import { AVATAR_STYLES, PRIORITY_META, STATUS_STYLES, TYPE_META, cx, focusRing, initials } from '@/ui/tokens';
import { Bookmark, Bug, Calendar, Check, ChevronDown, Flag } from '@/ui/icons';

/* ------------------------------------------------------------------ Button */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-card hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secondary: 'bg-surface text-ink ring-1 ring-inset ring-line-strong hover:bg-canvas active:bg-line disabled:text-ink-subtle',
  ghost: 'text-ink-muted hover:bg-black/5 hover:text-ink active:bg-black/10 disabled:text-ink-subtle',
  danger: 'bg-rose-600 text-white shadow-card hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-300',
};
const SIZES: Record<Size, string> = { sm: 'h-7 px-2.5 text-xs gap-1.5', md: 'h-9 px-3.5 text-sm gap-2' };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        focusRing,
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: 'light' | 'dark' }>(
  function IconButton({ label, className, children, tone = 'light', type = 'button', ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cx(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
          tone === 'light'
            ? 'text-ink-subtle hover:bg-black/5 hover:text-ink active:bg-black/10'
            : 'text-ink-inverse/60 hover:bg-white/10 hover:text-ink-inverse active:bg-white/15',
          focusRing,
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

/* ------------------------------------------------------------------ Avatars */

export function Avatar({ user, size = 'md', ring = false }: { user: User; size?: 'xs' | 'sm' | 'md'; ring?: boolean }) {
  const sizes = { xs: 'h-5 w-5 text-[9px]', sm: 'h-6 w-6 text-2xs', md: 'h-8 w-8 text-xs' };
  return (
    <span
      title={user.name}
      className={cx(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold',
        AVATAR_STYLES[user.avatarColor],
        sizes[size],
        ring && 'ring-2 ring-surface',
      )}
    >
      {initials(user.name)}
    </span>
  );
}

export function AvatarStack({ users, max = 3, size = 'sm' }: { users: User[]; max?: number; size?: 'xs' | 'sm' }) {
  if (users.length === 0) return null;
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <span className="flex -space-x-1" aria-label={`Assignees: ${users.map((u) => u.name).join(', ')}`}>
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size={size} ring />
      ))}
      {extra > 0 && (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-line text-2xs font-semibold text-ink-muted ring-2 ring-surface">
          +{extra}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ Badges */

/** Jira-style issue-type tile (blue check = Task, green bookmark = Story, red bug = Bug). */
export function TaskTypeIcon({ type, size = 'sm' }: { type: TaskType; size?: 'sm' | 'md' }) {
  const meta = TYPE_META[type];
  const Glyph = type === 'story' ? Bookmark : type === 'bug' ? Bug : Check;
  return (
    <span
      title={meta.label}
      aria-label={meta.label}
      role="img"
      className={cx('inline-flex shrink-0 items-center justify-center rounded-[3px] text-white', meta.tile, size === 'md' ? 'h-5 w-5' : 'h-4 w-4')}
    >
      <Glyph size={size === 'md' ? 13 : 11} strokeWidth={2.6} />
    </span>
  );
}

/** Priority as a single coloured icon (Jira cards show the icon, not the word). */
export function PriorityIcon({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];
  return (
    <span title={`${meta.label} priority`} className="inline-flex">
      <Flag size={13} className={meta.icon} aria-hidden />
      <span className="sr-only">{meta.label} priority</span>
    </span>
  );
}

export function PointsBadge({ points }: { points: number | null }) {
  if (points === null) return null;
  return (
    <span title={`${points} story point${points === 1 ? '' : 's'}`} className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-black/[0.06] px-1.5 text-2xs font-semibold tabular-nums text-ink-muted">
      {points}
    </span>
  );
}

export function LabelChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded bg-brand-50 px-1.5 py-px text-2xs font-medium text-brand-800 ring-1 ring-inset ring-brand-100">
      <span className="truncate">{label}</span>
      {onRemove && (
        <button type="button" aria-label={`Remove label ${label}`} onClick={onRemove} className="-mr-0.5 rounded text-brand-700/70 hover:text-brand-900">
          ×
        </button>
      )}
    </span>
  );
}

export function PriorityBadge({ priority, compact = false }: { priority: Priority; compact?: boolean }) {
  if (priority === 'none' && compact) return null;
  const meta = PRIORITY_META[priority];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-semibold ring-1 ring-inset',
        meta.badge,
      )}
    >
      <Flag size={11} className={meta.icon} />
      {meta.label}
    </span>
  );
}

export function StatusPill({ status }: { status: Status }) {
  const styles = STATUS_STYLES[status.color];
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-xs font-medium ring-1 ring-inset', styles.pill)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', styles.dot)} />
      {status.name}
    </span>
  );
}

export function StatusDot({ status, className }: { status: Pick<Status, 'color'>; className?: string }) {
  return <span className={cx('inline-block h-2 w-2 shrink-0 rounded-full', STATUS_STYLES[status.color].dot, className)} />;
}

/* ------------------------------------------------------------------ Due date */

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function formatDue(iso: string, now = new Date()): { label: string; tone: 'overdue' | 'soon' | 'normal' } {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(d) - startOfDay(now)) / DAY);
  const label =
    diff === 0
      ? 'Today'
      : diff === 1
        ? 'Tomorrow'
        : diff === -1
          ? 'Yesterday'
          : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
  return { label, tone: diff < 0 ? 'overdue' : diff <= 2 ? 'soon' : 'normal' };
}

export function DueDate({ iso, done }: { iso: string | null; done?: boolean }) {
  if (!iso) return null;
  const { label, tone } = formatDue(iso);
  const color = done ? 'text-ink-subtle' : tone === 'overdue' ? 'text-rose-600' : tone === 'soon' ? 'text-amber-700' : 'text-ink-muted';
  return (
    <span className={cx('inline-flex items-center gap-1 text-2xs font-medium', color)} title={new Date(iso).toLocaleString()}>
      <Calendar size={12} />
      {label}
    </span>
  );
}

/** "just now", "5m ago", "3h ago", "2d ago", else a short date. */
export function timeAgo(iso: string, now = new Date()): string {
  const secs = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (secs < 45) return 'just now';
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86_400) return `${Math.round(secs / 3600)}h ago`;
  if (secs < 7 * 86_400) return `${Math.round(secs / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ------------------------------------------------------------------ Feedback */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-md bg-line/70', className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx('flex flex-col items-center justify-center text-center', compact ? 'gap-1.5 px-3 py-6' : 'gap-3 px-6 py-16')}>
      {icon && (
        <div className={cx('flex items-center justify-center rounded-panel bg-brand-50 text-brand-600', compact ? 'h-8 w-8' : 'h-12 w-12')}>
          {icon}
        </div>
      )}
      <div>
        <p className={cx('font-semibold text-ink', compact ? 'text-xs' : 'text-base')}>{title}</p>
        {description && <p className={cx('mx-auto mt-1 max-w-sm text-ink-muted', compact ? 'text-2xs' : 'text-sm')}>{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Input styling without a width — combine with an explicit width utility. */
export const inputBase = cx(
  'block rounded-lg border-0 bg-surface px-3 py-2 text-sm text-ink shadow-card ring-1 ring-inset ring-line-strong',
  'placeholder:text-ink-subtle hover:ring-ink-subtle/60 focus:outline-none focus:ring-2 focus:ring-brand-500',
  'disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-subtle',
);

export const inputClass = cx(inputBase, 'w-full');

/** Native select with the browser arrow replaced by an inset chevron. `className` styles the select itself. */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative inline-flex shrink-0">
      <select {...props} className={cx(inputBase, 'cursor-pointer appearance-none pr-8', className)}>
        {children}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" />
    </span>
  );
}

export const labelClass = 'mb-1.5 block text-xs font-medium text-ink-muted';

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-xs font-medium text-rose-600">
      {message}
    </p>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line-strong bg-canvas px-1 py-px font-sans text-[10px] font-medium text-ink-subtle">{children}</kbd>
  );
}
