/** Ghost-placement logic shared by the ground plane and part-surface hover. */

import { snapToGrid } from '@/model/math';
import type { Transform, Vec3 } from '@/model/types';
import { IDENTITY_QUAT } from '@/model/types';
import { useDocumentStore } from '@/store/documentStore';
import { useEditorStore } from '@/store/editorStore';
import { placePart } from './commands';
import { findSnap, restingYOffset } from './snapping';

/** Re-aim the ghost at a pointed-at world position (ground or part surface). */
export function updateGhostFromPoint(point: Vec3): void {
  const editor = useEditorStore.getState();
  const placing = editor.placing;
  if (!placing) return;
  const doc = useDocumentStore.getState().doc;
  const grid = doc.settings.gridSize;
  const base: Transform = {
    position: [
      snapToGrid(point[0], grid),
      Math.max(point[1], 0) + restingYOffset(placing.type, placing.props),
      snapToGrid(point[2], grid),
    ],
    rotation: placing.transform?.rotation ?? IDENTITY_QUAT,
  };
  const snap = findSnap(doc, placing.type, placing.props, base, null);
  editor.updateGhost(snap ? snap.transform : base, snap);
}

/** Commit the current ghost as a real part. Placement mode stays active for
 * LEGO-style repeated placement; Esc ends it. */
export function commitGhost(): void {
  const placing = useEditorStore.getState().placing;
  if (!placing?.transform) return;
  placePart(placing.type, placing.props, placing.transform);
}
