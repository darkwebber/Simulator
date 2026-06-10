/** The contract every part type implements. Adding a new part (punch card,
 * drum box, sequencer, …) means writing one new PartDefinition and registering
 * it — the editor UI, serialization, physics assembly and rendering all work
 * off this interface. */

import type * as THREE from 'three';
import type { ConnectionKind, PropValue, Transform, Vec3 } from '@/model/types';

export type AnchorKind =
  | 'axle-shaft'
  | 'axle-socket'
  | 'mount-hole'
  | 'mount-peg'
  | 'spring-eye';

export interface AnchorDef {
  id: string;
  kind: AnchorKind;
  /** Part-local position. */
  position: Vec3;
  /** Part-local primary axis (rotation / insertion axis), unit length. */
  axis: Vec3;
  /** Connection kind created when something snaps here. */
  defaultConnection: ConnectionKind;
  /** Extra connection props applied on snap, e.g. { keyed: true }. */
  connectionProps?: Record<string, number | boolean>;
}

export type ColliderSpec =
  | { shape: 'cuboid'; halfExtents: Vec3; offset: Transform }
  /** Cylinder axis is local +Y (matches both Rapier and three.js conventions). */
  | { shape: 'cylinder'; halfHeight: number; radius: number; offset: Transform }
  | { shape: 'ball'; radius: number; offset: Transform };

export type PropFieldSpec =
  | {
      key: string;
      label: string;
      type: 'number';
      min?: number;
      max?: number;
      step?: number;
      unit?: string;
      integer?: boolean;
    }
  | { key: string; label: string; type: 'boolean' }
  | {
      key: string;
      label: string;
      type: 'select';
      options: Array<{ value: string; label: string }>;
    };

export interface PhysicalProps {
  /** kg per world-unit³ (world unit = 1 cm). */
  density: number;
  friction: number;
  restitution: number;
}

export interface VisualProps {
  color: string;
  metalness: number;
  roughness: number;
}

export type PartProps = Record<string, PropValue>;

export type SimTag = 'gear' | 'motor' | 'spring';

export interface PartDefinition {
  type: string;
  label: string;
  category: 'structure' | 'transmission' | 'power' | 'mechanism';
  description: string;
  defaultProps: PartProps;
  propSchema: PropFieldSpec[];
  getAnchors(props: PartProps): AnchorDef[];
  buildGeometry(props: PartProps): THREE.BufferGeometry;
  buildColliders(props: PartProps): ColliderSpec[];
  physical(props: PartProps): PhysicalProps;
  visual(props: PartProps): VisualProps;
  /** Marks behavior the simulation engine must wire up (gear coupling, motor drive…). */
  simTags?: SimTag[];
  /** Parts that anchor the machine to the world (baseplate) build fixed bodies. */
  isStatic?(props: PartProps): boolean;
}

export const IDENTITY: Transform = { position: [0, 0, 0], rotation: [0, 0, 0, 1] };

export function num(props: PartProps, key: string, fallback: number): number {
  const v = props[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function bool(props: PartProps, key: string, fallback: boolean): boolean {
  const v = props[key];
  return typeof v === 'boolean' ? v : fallback;
}
