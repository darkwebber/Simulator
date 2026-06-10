/** Anchor snapping: how parts attach "like LEGO".
 *
 * Connections are *derived from geometry*: whenever two compatible anchors
 * coincide (position + axis), a connection exists; move them apart and it is
 * removed. `reconcilePartConnections` enforces this after every placement,
 * drag or property edit, so an axle dropped across two posts picks up both
 * bearings and a spring's second eye hooks up automatically.
 */

import { nanoid } from 'nanoid';
import {
  qFromUnitVectors,
  qMultiply,
  qNormalize,
  qRotate,
  transformDirection,
  transformPoint,
  vDistance,
  vDot,
  vSub,
} from '@/model/math';
import type {
  ConnectionInstance,
  ConnectionKind,
  MachineDocument,
  PartInstance,
  Transform,
  Vec3,
} from '@/model/types';
import type { AnchorDef, AnchorKind } from '@/parts/partDefinition';
import { getPartDef } from '@/parts/registry';

/** Search radius (cm) for pulling a dragged anchor onto a target anchor. */
export const SNAP_RADIUS = 1.5;
/** Two anchors closer than this (and axis-aligned) are considered connected. */
export const CONNECT_TOLERANCE = 0.3;
const AXIS_ALIGN_TOLERANCE = Math.cos((15 * Math.PI) / 180);

const COMPAT: Record<AnchorKind, AnchorKind[]> = {
  'axle-shaft': ['axle-socket'],
  'axle-socket': ['axle-shaft'],
  'mount-peg': ['mount-hole', 'spring-eye'],
  'mount-hole': ['mount-peg', 'spring-eye'],
  'spring-eye': ['mount-peg', 'mount-hole'],
};

export function anchorsCompatible(a: AnchorKind, b: AnchorKind): boolean {
  return COMPAT[a]?.includes(b) ?? false;
}

export function connectionKindForPair(a: AnchorKind, b: AnchorKind): ConnectionKind {
  const pair = [a, b].sort().join('+');
  switch (pair) {
    case 'axle-shaft+axle-socket':
      return 'revolute';
    default:
      // peg+hole, spring-eye attachments: rigid.
      return 'fixed';
  }
}

/** Coaxial fits (shaft in socket) accept either axis direction; mating fits
 * (peg in hole) must be anti-parallel. */
function isCoaxialPair(a: AnchorKind, b: AnchorKind): boolean {
  return a === 'axle-shaft' || a === 'axle-socket' || b === 'axle-shaft' || b === 'axle-socket';
}

export interface WorldAnchor {
  partId: string;
  anchor: AnchorDef;
  worldPos: Vec3;
  worldAxis: Vec3;
}

export function worldAnchorsOf(part: PartInstance): WorldAnchor[] {
  const def = getPartDef(part.type);
  return def.getAnchors(part.props).map((anchor) => ({
    partId: part.id,
    anchor,
    worldPos: transformPoint(part.transform, anchor.position),
    worldAxis: transformDirection(part.transform, anchor.axis),
  }));
}

/**
 * Solve the transform that brings `movingAnchor` (local on the moving part)
 * onto `target` (world), rotating the current orientation as little as
 * possible. For mating pairs the axes align anti-parallel; for coaxial pairs
 * whichever direction is closest wins.
 */
export function solveSnapTransform(
  current: Transform,
  movingAnchor: AnchorDef,
  target: WorldAnchor,
  coaxial: boolean,
): Transform {
  const movingAxisWorld = transformDirection(current, movingAnchor.axis);
  let desired: Vec3 = [-target.worldAxis[0], -target.worldAxis[1], -target.worldAxis[2]];
  if (coaxial && vDot(movingAxisWorld, target.worldAxis) > 0) {
    desired = target.worldAxis;
  }
  const correction = qFromUnitVectors(movingAxisWorld, desired);
  const rotation = qNormalize(qMultiply(correction, current.rotation));
  const anchorOffset = qRotate(rotation, movingAnchor.position);
  return { position: vSub(target.worldPos, anchorOffset), rotation };
}

export interface SnapResult {
  movingAnchorId: string;
  target: WorldAnchor;
  transform: Transform;
}

/**
 * Find the best snap for a (possibly not yet placed) part at `transform`.
 * Returns null when nothing compatible is within SNAP_RADIUS.
 */
export function findSnap(
  doc: MachineDocument,
  movingType: string,
  movingProps: PartInstance['props'],
  transform: Transform,
  excludePartId: string | null,
): SnapResult | null {
  const movingDef = getPartDef(movingType);
  const movingAnchors = movingDef.getAnchors(movingProps);
  let best: { dist: number; result: SnapResult } | null = null;

  for (const other of doc.parts) {
    if (other.id === excludePartId) continue;
    for (const target of worldAnchorsOf(other)) {
      for (const moving of movingAnchors) {
        if (!anchorsCompatible(moving.kind, target.anchor.kind)) continue;
        const movingWorld = transformPoint(transform, moving.position);
        const dist = vDistance(movingWorld, target.worldPos);
        if (dist > SNAP_RADIUS) continue;
        if (!best || dist < best.dist) {
          const snapped = solveSnapTransform(
            transform,
            moving,
            target,
            isCoaxialPair(moving.kind, target.anchor.kind),
          );
          best = {
            dist,
            result: { movingAnchorId: moving.id, target, transform: snapped },
          };
        }
      }
    }
  }
  return best?.result ?? null;
}

function anchorsCoincide(a: WorldAnchor, b: WorldAnchor): boolean {
  if (vDistance(a.worldPos, b.worldPos) > CONNECT_TOLERANCE) return false;
  return Math.abs(vDot(a.worldAxis, b.worldAxis)) >= AXIS_ALIGN_TOLERANCE;
}

/**
 * Derive the connection list for one part from current geometry: drop
 * connections whose anchors moved apart, create connections for coincident
 * compatible anchor pairs. Returns the updated document.
 */
export function reconcilePartConnections(
  doc: MachineDocument,
  partId: string,
): MachineDocument {
  const part = doc.parts.find((p) => p.id === partId);
  if (!part) return doc;
  const partAnchors = worldAnchorsOf(part);
  const others = doc.parts.filter((p) => p.id !== partId);
  const otherAnchors = new Map(others.map((p) => [p.id, worldAnchorsOf(p)]));

  const findWorld = (pid: string, anchorId: string): WorldAnchor | undefined => {
    const list = pid === partId ? partAnchors : otherAnchors.get(pid);
    return list?.find((a) => a.anchor.id === anchorId);
  };

  // Keep connections (of this part) whose anchors still coincide.
  const kept: ConnectionInstance[] = [];
  for (const c of doc.connections) {
    const involves = c.a.partId === partId || c.b.partId === partId;
    if (!involves) {
      kept.push(c);
      continue;
    }
    const wa = findWorld(c.a.partId, c.a.anchorId);
    const wb = findWorld(c.b.partId, c.b.anchorId);
    if (wa && wb && anchorsCoincide(wa, wb)) kept.push(c);
  }

  // Create missing connections for coincident pairs.
  const created: ConnectionInstance[] = [];
  const isPaired = (a: WorldAnchor, b: WorldAnchor) =>
    [...kept, ...created].some(
      (c) =>
        (c.a.partId === a.partId &&
          c.a.anchorId === a.anchor.id &&
          c.b.partId === b.partId &&
          c.b.anchorId === b.anchor.id) ||
        (c.a.partId === b.partId &&
          c.a.anchorId === b.anchor.id &&
          c.b.partId === a.partId &&
          c.b.anchorId === a.anchor.id),
    );

  for (const mine of partAnchors) {
    for (const other of others) {
      for (const theirs of otherAnchors.get(other.id)!) {
        if (!anchorsCompatible(mine.anchor.kind, theirs.anchor.kind)) continue;
        if (!anchorsCoincide(mine, theirs)) continue;
        if (isPaired(mine, theirs)) continue;
        created.push({
          id: nanoid(8),
          kind: connectionKindForPair(mine.anchor.kind, theirs.anchor.kind),
          a: { partId: mine.partId, anchorId: mine.anchor.id },
          b: { partId: theirs.partId, anchorId: theirs.anchor.id },
          props: {
            ...mine.anchor.connectionProps,
            ...theirs.anchor.connectionProps,
          },
        });
      }
    }
  }

  if (created.length === 0 && kept.length === doc.connections.length) return doc;
  return { ...doc, connections: [...kept, ...created] };
}

/** All world anchors on existing parts that something compatible could snap to
 * — used to render glowing markers while placing/dragging. */
export function compatibleTargets(
  doc: MachineDocument,
  movingType: string,
  movingProps: PartInstance['props'],
  excludePartId: string | null,
): WorldAnchor[] {
  const movingKinds = new Set(
    getPartDef(movingType)
      .getAnchors(movingProps)
      .map((a) => a.kind),
  );
  const out: WorldAnchor[] = [];
  for (const part of doc.parts) {
    if (part.id === excludePartId) continue;
    for (const wa of worldAnchorsOf(part)) {
      if ([...movingKinds].some((k) => anchorsCompatible(k, wa.anchor.kind))) {
        out.push(wa);
      }
    }
  }
  return out;
}

/** Ground offset so a freshly placed part rests on the plane y = floorY. */
export function restingYOffset(type: string, props: PartInstance['props']): number {
  const def = getPartDef(type);
  let minY = 0;
  for (const c of def.buildColliders(props)) {
    const p = c.offset.position;
    if (c.shape === 'cuboid') minY = Math.min(minY, p[1] - c.halfExtents[1]);
    else if (c.shape === 'cylinder') minY = Math.min(minY, p[1] - c.halfHeight);
    else minY = Math.min(minY, p[1] - c.radius);
  }
  return -minY;
}
