/** Immutable operations on MachineDocument. Every function returns a new document. */

import type {
  ConnectionInstance,
  MachineDocument,
  PartInstance,
  Transform,
} from './types';

function touch(doc: MachineDocument): MachineDocument {
  return { ...doc, meta: { ...doc.meta, modifiedAt: new Date().toISOString() } };
}

export function addPart(doc: MachineDocument, part: PartInstance): MachineDocument {
  return touch({ ...doc, parts: [...doc.parts, part] });
}

export function removePart(doc: MachineDocument, partId: string): MachineDocument {
  return touch({
    ...doc,
    parts: doc.parts.filter((p) => p.id !== partId),
    connections: doc.connections.filter(
      (c) => c.a.partId !== partId && c.b.partId !== partId,
    ),
  });
}

export function updatePart(
  doc: MachineDocument,
  partId: string,
  update: Partial<Pick<PartInstance, 'name' | 'props' | 'transform'>>,
): MachineDocument {
  return touch({
    ...doc,
    parts: doc.parts.map((p) => (p.id === partId ? { ...p, ...update } : p)),
  });
}

export function setPartTransform(
  doc: MachineDocument,
  partId: string,
  transform: Transform,
): MachineDocument {
  return updatePart(doc, partId, { transform });
}

export function addConnection(
  doc: MachineDocument,
  connection: ConnectionInstance,
): MachineDocument {
  return touch({ ...doc, connections: [...doc.connections, connection] });
}

export function removeConnection(doc: MachineDocument, id: string): MachineDocument {
  return touch({ ...doc, connections: doc.connections.filter((c) => c.id !== id) });
}

export function updateConnection(
  doc: MachineDocument,
  id: string,
  update: Partial<Pick<ConnectionInstance, 'kind' | 'props'>>,
): MachineDocument {
  return touch({
    ...doc,
    connections: doc.connections.map((c) => (c.id === id ? { ...c, ...update } : c)),
  });
}

export function getPart(doc: MachineDocument, partId: string): PartInstance | undefined {
  return doc.parts.find((p) => p.id === partId);
}

export function connectionsOfPart(
  doc: MachineDocument,
  partId: string,
): ConnectionInstance[] {
  return doc.connections.filter(
    (c) => c.a.partId === partId || c.b.partId === partId,
  );
}

/** True if this exact anchor pair is already connected (in either order). */
export function isAnchorPairConnected(
  doc: MachineDocument,
  aPartId: string,
  aAnchorId: string,
  bPartId: string,
  bAnchorId: string,
): boolean {
  return doc.connections.some(
    (c) =>
      (c.a.partId === aPartId &&
        c.a.anchorId === aAnchorId &&
        c.b.partId === bPartId &&
        c.b.anchorId === bAnchorId) ||
      (c.a.partId === bPartId &&
        c.a.anchorId === bAnchorId &&
        c.b.partId === aPartId &&
        c.b.anchorId === aAnchorId),
  );
}
