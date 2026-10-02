import { create } from 'zustand';
import type { AppError, Result } from '@/domain/result';

export type ToastKind = 'success' | 'error' | 'info';
export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>, ttlMs?: number) => number;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (t, ttlMs = t.kind === 'error' ? 6000 : 3500) => {
    const id = ++seq;
    set({ toasts: [...get().toasts.slice(-3), { ...t, id }] });
    if (ttlMs > 0) setTimeout(() => get().dismiss(id), ttlMs);
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

const ERROR_TITLES: Record<AppError['code'], string> = {
  FORBIDDEN: 'Permission denied',
  NOT_FOUND: 'Not found',
  VALIDATION: 'Check your input',
  INVALID_PARENT: 'Not allowed here',
  CONFLICT: 'Conflict',
};

export const toast = {
  success: (title: string, message?: string) => useToastStore.getState().push({ kind: 'success', title, message }),
  info: (title: string, message?: string) => useToastStore.getState().push({ kind: 'info', title, message }),
  error: (err: AppError) => useToastStore.getState().push({ kind: 'error', title: ERROR_TITLES[err.code], message: err.message }),
};

/** Shows an error toast for failed results (and an optional success toast). Returns true on success. */
export function notify<T>(res: Result<T>, success?: string): res is { data: T } {
  if (res.error) {
    toast.error(res.error);
    return false;
  }
  if (success) toast.success(success);
  return true;
}
