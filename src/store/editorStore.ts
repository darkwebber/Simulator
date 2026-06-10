import { create } from 'zustand';
import type { PartProps } from '@/parts/partDefinition';
import type { Transform } from '@/model/types';
import type { SnapResult } from '@/editor/snapping';

export interface PlacingState {
  type: string;
  props: PartProps;
  /** Current ghost pose (already snapped if `snap` is set). */
  transform: Transform | null;
  snap: SnapResult | null;
}

interface EditorState {
  selectedPartId: string | null;
  placing: PlacingState | null;
  gizmoMode: 'translate' | 'rotate';
  gizmoDragging: boolean;
  select: (partId: string | null) => void;
  startPlacing: (type: string, props: PartProps) => void;
  updateGhost: (transform: Transform | null, snap: SnapResult | null) => void;
  cancelPlacing: () => void;
  setGizmoMode: (mode: 'translate' | 'rotate') => void;
  setGizmoDragging: (dragging: boolean) => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  selectedPartId: null,
  placing: null,
  gizmoMode: 'translate',
  gizmoDragging: false,
  select: (selectedPartId) => set({ selectedPartId, placing: null }),
  startPlacing: (type, props) =>
    set({ placing: { type, props, transform: null, snap: null }, selectedPartId: null }),
  updateGhost: (transform, snap) =>
    set((s) => (s.placing ? { placing: { ...s.placing, transform, snap } } : s)),
  cancelPlacing: () => set({ placing: null }),
  setGizmoMode: (gizmoMode) => set({ gizmoMode }),
  setGizmoDragging: (gizmoDragging) => set({ gizmoDragging }),
}));
