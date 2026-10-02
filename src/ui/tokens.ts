import type { Priority, StatusCategory, StatusColor, User } from '@/domain/types';

/**
 * Semantic colour → Tailwind class maps. Full class strings are spelled out so Tailwind's JIT
 * picks them up. Every surface (kanban card, list row, drawer, pickers) uses these maps, which
 * keeps status / priority colours identical across views.
 */

export const STATUS_STYLES: Record<StatusColor, { dot: string; pill: string; column: string; bar: string }> = {
  slate: { dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-700 ring-slate-200', column: 'bg-slate-50', bar: 'bg-slate-400' },
  blue: { dot: 'bg-blue-500', pill: 'bg-blue-50 text-blue-700 ring-blue-200', column: 'bg-blue-50/40', bar: 'bg-blue-500' },
  amber: { dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-800 ring-amber-200', column: 'bg-amber-50/40', bar: 'bg-amber-500' },
  violet: { dot: 'bg-violet-500', pill: 'bg-violet-50 text-violet-700 ring-violet-200', column: 'bg-violet-50/40', bar: 'bg-violet-500' },
  green: { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', column: 'bg-emerald-50/40', bar: 'bg-emerald-500' },
  rose: { dot: 'bg-rose-500', pill: 'bg-rose-50 text-rose-700 ring-rose-200', column: 'bg-rose-50/40', bar: 'bg-rose-500' },
  teal: { dot: 'bg-teal-500', pill: 'bg-teal-50 text-teal-700 ring-teal-200', column: 'bg-teal-50/40', bar: 'bg-teal-500' },
};

export const PRIORITY_META: Record<Priority, { label: string; rank: number; badge: string; icon: string }> = {
  urgent: { label: 'Urgent', rank: 0, badge: 'bg-rose-50 text-rose-700 ring-rose-200', icon: 'text-rose-600' },
  high: { label: 'High', rank: 1, badge: 'bg-orange-50 text-orange-700 ring-orange-200', icon: 'text-orange-500' },
  normal: { label: 'Normal', rank: 2, badge: 'bg-sky-50 text-sky-700 ring-sky-200', icon: 'text-sky-500' },
  low: { label: 'Low', rank: 3, badge: 'bg-slate-100 text-slate-600 ring-slate-200', icon: 'text-slate-400' },
  none: { label: 'No priority', rank: 4, badge: 'bg-transparent text-ink-subtle ring-line', icon: 'text-ink-subtle' },
};

export const CATEGORY_LABEL: Record<StatusCategory, string> = {
  todo: 'Not started',
  in_progress: 'Active',
  done: 'Completed',
};

export const AVATAR_STYLES: Record<User['avatarColor'], string> = {
  rose: 'bg-rose-100 text-rose-700',
  sky: 'bg-sky-100 text-sky-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-800',
  violet: 'bg-violet-100 text-violet-700',
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Shared focus ring for interactive elements. */
export const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
