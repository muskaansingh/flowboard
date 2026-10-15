import { useEffect, useRef } from 'react';

/** True when the keystroke belongs to a text field or an open dialog, so global shortcuts should stay out of the way. */
export function isTypingOrModal(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null;
  if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return true;
  return !!document.querySelector('[role="dialog"]');
}

/** Single-key global shortcut (no modifiers), ignored while typing or when a dialog is open. */
export function useShortcut(key: string, handler: () => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== key || e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTypingOrModal(e)) return;
      e.preventDefault();
      ref.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, enabled]);
}
