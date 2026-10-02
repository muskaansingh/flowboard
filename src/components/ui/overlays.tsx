import { useState, type ReactNode } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { create } from 'zustand';
import { useToastStore } from '@/store/toastStore';
import { Alert, CheckCircle, Info, X } from '@/ui/icons';
import { cx } from '@/ui/tokens';
import { Button, IconButton } from './primitives';

/* ------------------------------------------------------------------ Modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-xl' };
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-ink/30 backdrop-blur-[1px] animate-fade-in" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto p-4 pt-[12vh]">
        <DialogPanel className={cx('w-full rounded-panel bg-surface shadow-lift ring-1 ring-black/5 animate-fade-in', widths[size])}>
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <DialogTitle className="text-base font-semibold text-ink">{title}</DialogTitle>
              {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
            </div>
            <IconButton label="Close" onClick={onClose}>
              <X />
            </IconButton>
          </div>
          {children && <div className="px-5 py-4">{children}</div>}
          {footer && <div className="flex justify-end gap-2 rounded-b-panel border-t border-line bg-canvas px-5 py-3">{footer}</div>}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ Confirm */

interface ConfirmRequest {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  resolve: (ok: boolean) => void;
}

const useConfirmStore = create<{ request: ConfirmRequest | null; set: (r: ConfirmRequest | null) => void }>()((set) => ({
  request: null,
  set: (request) => set({ request }),
}));

/** Promise-based confirmation used before every destructive action. */
export function confirmAction(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.getState().set({ ...opts, resolve }));
}

export function ConfirmHost() {
  const request = useConfirmStore((s) => s.request);
  const setRequest = useConfirmStore((s) => s.set);
  const [last, setLast] = useState<ConfirmRequest | null>(null);
  if (request && request !== last) setLast(request);
  const shown = request ?? last;

  const close = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };

  return (
    <Modal
      open={!!request}
      onClose={() => close(false)}
      title={shown?.title ?? ''}
      size="sm"
      footer={
        <>
          <Button onClick={() => close(false)}>Cancel</Button>
          <Button variant={shown?.tone === 'primary' ? 'primary' : 'danger'} onClick={() => close(true)} data-autofocus>
            {shown?.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      <div className="text-sm text-ink-muted">{shown?.message}</div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ Toasts */

const TOAST_STYLE = {
  success: { icon: <CheckCircle className="text-emerald-600" />, bar: 'bg-emerald-500' },
  error: { icon: <Alert className="text-rose-600" />, bar: 'bg-rose-500' },
  info: { icon: <Info className="text-brand-600" />, bar: 'bg-brand-500' },
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className="pointer-events-auto relative flex gap-3 overflow-hidden rounded-card bg-surface p-3 pl-4 shadow-pop ring-1 ring-black/5 animate-toast-in"
        >
          <span className={cx('absolute inset-y-0 left-0 w-1', TOAST_STYLE[t.kind].bar)} />
          <span className="mt-0.5">{TOAST_STYLE[t.kind].icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{t.title}</p>
            {t.message && <p className="mt-0.5 text-xs text-ink-muted">{t.message}</p>}
          </div>
          <IconButton label="Dismiss notification" onClick={() => dismiss(t.id)} className="-mr-1 -mt-1">
            <X size={14} />
          </IconButton>
        </div>
      ))}
    </div>
  );
}
