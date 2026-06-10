/** High-level document mutations. Each exported function is one undo unit. */

import { nanoid } from 'nanoid';
import * as docOps from '@/model/document';
import type { PartInstance, Transform } from '@/model/types';
import type { PartProps } from '@/parts/partDefinition';
import { getPartDef } from '@/parts/registry';
import { reconcilePartConnections } from './snapping';
import { useDocumentStore } from '@/store/documentStore';
import { useEditorStore } from '@/store/editorStore';

function mutate(fn: Parameters<ReturnType<typeof useDocumentStore.getState>['mutate']>[0]) {
  useDocumentStore.getState().mutate(fn);
}

let partCounter = 0;

export function placePart(type: string, props: PartProps, transform: Transform): string {
  const def = getPartDef(type);
  const part: PartInstance = {
    id: nanoid(8),
    type,
    name: `${def.label} ${++partCounter}`,
    props: { ...props },
    transform,
  };
  mutate((doc) => reconcilePartConnections(docOps.addPart(doc, part), part.id));
  return part.id;
}

export function movePart(partId: string, transform: Transform): void {
  mutate((doc) =>
    reconcilePartConnections(docOps.setPartTransform(doc, partId, transform), partId),
  );
}

export function deletePart(partId: string): void {
  const editor = useEditorStore.getState();
  if (editor.selectedPartId === partId) editor.select(null);
  mutate((doc) => docOps.removePart(doc, partId));
}

export function updatePartProps(partId: string, props: PartProps): void {
  // Anchors are parametric, so prop edits can move them — re-derive connections.
  mutate((doc) =>
    reconcilePartConnections(
      docOps.updatePart(doc, partId, { props: { ...props } }),
      partId,
    ),
  );
}

export function renamePart(partId: string, name: string): void {
  mutate((doc) => docOps.updatePart(doc, partId, { name }));
}

export function updateConnectionProps(
  connectionId: string,
  props: Record<string, number | boolean>,
): void {
  mutate((doc) => docOps.updateConnection(doc, connectionId, { props }));
}

export function deleteConnection(connectionId: string): void {
  mutate((doc) => docOps.removeConnection(doc, connectionId));
}
