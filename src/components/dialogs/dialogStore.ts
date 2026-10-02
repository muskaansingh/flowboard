import { create } from 'zustand';
import type { ID } from '@/domain/types';

export type DialogRequest =
  | { kind: 'create'; parentId: ID }
  | { kind: 'rename'; id: ID }
  | { kind: 'sharing'; id: ID }
  | { kind: 'statuses'; listId: ID };

export const useDialogStore = create<{ dialog: DialogRequest | null; open: (d: DialogRequest) => void; close: () => void }>()(
  (set) => ({
    dialog: null,
    open: (dialog) => set({ dialog }),
    close: () => set({ dialog: null }),
  }),
);
