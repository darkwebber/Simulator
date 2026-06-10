import { create } from 'zustand';
import { temporal } from 'zundo';
import type { MachineDocument } from '@/model/types';
import { emptyDocument } from '@/model/types';

interface DocumentState {
  doc: MachineDocument;
  setDoc: (doc: MachineDocument) => void;
  /** Apply an immutable mutation; one call = one undo step (unless paused). */
  mutate: (fn: (doc: MachineDocument) => MachineDocument) => void;
}

export const useDocumentStore = create<DocumentState>()(
  temporal(
    (set, get) => ({
      doc: emptyDocument(),
      setDoc: (doc) => set({ doc }),
      mutate: (fn) => {
        const next = fn(get().doc);
        if (next !== get().doc) set({ doc: next });
      },
    }),
    {
      partialize: (state) => ({ doc: state.doc }),
      limit: 200,
      equality: (a, b) => a.doc === b.doc,
    },
  ),
);

export const docTemporal = useDocumentStore.temporal;

export function undo(): void {
  docTemporal.getState().undo();
}

export function redo(): void {
  docTemporal.getState().redo();
}
