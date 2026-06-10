import { describe, expect, it } from 'vitest';
import '@/parts'; // register built-in part defs
import { emptyDocument, type MachineDocument, type PartInstance } from '@/model/types';
import { transformDirection, transformPoint, vDistance } from '@/model/math';
import { getPartDef } from '@/parts/registry';
import {
  connectionKindForPair,
  findSnap,
  reconcilePartConnections,
  solveSnapTransform,
  worldAnchorsOf,
} from './snapping';

function makePart(
  id: string,
  type: string,
  position: [number, number, number],
  extraProps: Record<string, number | boolean | string> = {},
): PartInstance {
  return {
    id,
    type,
    props: { ...getPartDef(type).defaultProps, ...extraProps },
    transform: { position, rotation: [0, 0, 0, 1] },
  };
}

describe('connectionKindForPair', () => {
  it('shaft+socket is a pivot, peg+hole is rigid', () => {
    expect(connectionKindForPair('axle-shaft', 'axle-socket')).toBe('revolute');
    expect(connectionKindForPair('mount-peg', 'mount-hole')).toBe('fixed');
    expect(connectionKindForPair('spring-eye', 'mount-peg')).toBe('fixed');
  });
});

describe('solveSnapTransform', () => {
  it('positions the moving anchor exactly on the target', () => {
    const movingAnchor = getPartDef('frameBeam').getAnchors(
      getPartDef('frameBeam').defaultProps,
    )[0]; // bottom peg at [0,-4,0], axis [0,-1,0]
    const target = {
      partId: 'plate',
      anchor: {
        id: 'hole',
        kind: 'mount-hole' as const,
        position: [0, 0, 0] as [number, number, number],
        axis: [0, 1, 0] as [number, number, number],
        defaultConnection: 'fixed' as const,
      },
      worldPos: [3, 0.5, -5] as [number, number, number],
      worldAxis: [0, 1, 0] as [number, number, number],
    };
    const t = solveSnapTransform(
      { position: [10, 9, 8], rotation: [0, 0, 0, 1] },
      movingAnchor,
      target,
      false,
    );
    // Peg lands in the hole, post stays upright (anti-parallel mating).
    const pegWorld = transformPoint(t, movingAnchor.position);
    expect(vDistance(pegWorld, [3, 0.5, -5])).toBeLessThan(1e-9);
    const axisWorld = transformDirection(t, movingAnchor.axis);
    expect(axisWorld[1]).toBeCloseTo(-1, 9);
  });
});

describe('findSnap + reconcile', () => {
  function docWithPlate(): MachineDocument {
    const doc = emptyDocument();
    doc.parts.push(makePart('plate', 'baseplate', [0, 0, 0]));
    return doc;
  }

  it('snaps a post peg onto a baseplate hole and creates a fixed connection', () => {
    let doc = docWithPlate();
    const plateAnchors = worldAnchorsOf(doc.parts[0]);
    const hole = plateAnchors[0];
    // Post hovering 1 cm off the hole.
    const post = makePart('post', 'frameBeam', [
      hole.worldPos[0] + 0.4,
      hole.worldPos[1] + 4 + 0.4,
      hole.worldPos[2],
    ]);
    const snap = findSnap(doc, post.type, post.props, post.transform, null);
    expect(snap).not.toBeNull();
    post.transform = snap!.transform;
    doc = { ...doc, parts: [...doc.parts, post] };
    doc = reconcilePartConnections(doc, 'post');
    expect(doc.connections).toHaveLength(1);
    expect(doc.connections[0].kind).toBe('fixed');
  });

  it('drops the connection when the part moves away', () => {
    let doc = docWithPlate();
    const hole = worldAnchorsOf(doc.parts[0])[0];
    const post = makePart('post', 'frameBeam', [
      hole.worldPos[0],
      hole.worldPos[1] + 4,
      hole.worldPos[2],
    ]);
    doc = { ...doc, parts: [...doc.parts, post] };
    doc = reconcilePartConnections(doc, 'post');
    expect(doc.connections).toHaveLength(1);

    doc = {
      ...doc,
      parts: doc.parts.map((p) =>
        p.id === 'post'
          ? { ...p, transform: { ...p.transform, position: [50, 10, 50] as never } }
          : p,
      ),
    };
    doc = reconcilePartConnections(doc, 'post');
    expect(doc.connections).toHaveLength(0);
  });

  it('a gear snapped onto an axle inherits keyed from its props', () => {
    let doc = emptyDocument();
    // Upright axle; gear placed at a shaft anchor.
    doc.parts.push(makePart('shaft', 'axle', [0, 5, 0]));
    const gear = makePart('gear', 'spurGear', [0, 5, 0], { keyed: true });
    doc = { ...doc, parts: [...doc.parts, gear] };
    doc = reconcilePartConnections(doc, 'gear');
    expect(doc.connections).toHaveLength(1);
    expect(doc.connections[0].kind).toBe('revolute');
    expect(doc.connections[0].props.keyed).toBe(true);
  });

  it('an axle dropped across two posts picks up both bearings', () => {
    let doc = docWithPlate();
    // Two posts 6 cm apart; bearing_0 sits at post top − 1 cm, axis Z.
    const postDef = getPartDef('frameBeam');
    const postProps = { ...postDef.defaultProps };
    doc.parts.push(
      { ...makePart('postA', 'frameBeam', [0, 4.5, -3]), props: postProps },
      { ...makePart('postB', 'frameBeam', [0, 4.5, 3]), props: postProps },
    );
    // Axle along Z through both bearings (rotate local Y → Z).
    const axle: PartInstance = {
      id: 'ax',
      type: 'axle',
      props: { length: 8, radius: 0.4 },
      transform: {
        position: [0, 7.5, 0],
        rotation: [Math.SQRT1_2, 0, 0, Math.SQRT1_2], // 90° about X: Y→Z
      },
    };
    doc = { ...doc, parts: [...doc.parts, axle] };
    doc = reconcilePartConnections(doc, 'ax');
    const axleConns = doc.connections.filter(
      (c) => c.a.partId === 'ax' || c.b.partId === 'ax',
    );
    expect(axleConns).toHaveLength(2);
    expect(axleConns.every((c) => c.kind === 'revolute')).toBe(true);
  });
});
