/** Pure data model. This module must not import three.js, Rapier, or React. */

export type Vec3 = [number, number, number];
/** Quaternion as [x, y, z, w]. */
export type Quat = [number, number, number, number];

export interface Transform {
  position: Vec3;
  rotation: Quat;
}

export type PropValue = number | boolean | string;

export interface PartInstance {
  id: string;
  /** Key into the part registry, e.g. 'spurGear'. */
  type: string;
  name?: string;
  props: Record<string, PropValue>;
  /** World transform of the part's rest pose (edit mode). */
  transform: Transform;
}

export type ConnectionKind = 'fixed' | 'revolute' | 'prismatic' | 'spring';

export interface AnchorRef {
  partId: string;
  anchorId: string;
}

export interface ConnectionInstance {
  id: string;
  kind: ConnectionKind;
  a: AnchorRef;
  b: AnchorRef;
  /** e.g. { keyed: true } on an axle socket. */
  props: Record<string, number | boolean>;
}

export interface MachineDocument {
  schemaVersion: 1;
  meta: {
    name: string;
    createdAt: string;
    modifiedAt: string;
  };
  settings: {
    gravity: Vec3;
    /** Grid snap step in world units (cm). */
    gridSize: number;
  };
  parts: PartInstance[];
  connections: ConnectionInstance[];
}

export const IDENTITY_QUAT: Quat = [0, 0, 0, 1];

export function emptyDocument(name = 'Untitled machine'): MachineDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    meta: { name, createdAt: now, modifiedAt: now },
    settings: { gravity: [0, -981, 0], gridSize: 0.5 },
    parts: [],
    connections: [],
  };
}
