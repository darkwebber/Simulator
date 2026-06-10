import { boxGeometry, cylinderGeometry, merged } from '@/geometry/primitives';
import type { AnchorDef, PartDefinition } from '../partDefinition';
import { IDENTITY, num } from '../partDefinition';

/**
 * Vertical post / structural beam. A peg at the bottom mounts into baseplate
 * holes; bearing holes near the top carry axles (revolute) or pin onto hinge
 * pins — so it doubles as a lever arm.
 */
export const frameBeam: PartDefinition = {
  type: 'frameBeam',
  label: 'Frame post',
  category: 'structure',
  description:
    'Structural post with a mounting peg, side axle bearings and a top bearing for vertical axles.',
  defaultProps: { height: 8, width: 1.6, depth: 1.6 },
  propSchema: [
    { key: 'height', label: 'Height', type: 'number', min: 2, max: 40, step: 0.5, unit: 'cm' },
    { key: 'width', label: 'Width', type: 'number', min: 0.8, max: 4, step: 0.2, unit: 'cm' },
    { key: 'depth', label: 'Depth', type: 'number', min: 0.8, max: 4, step: 0.2, unit: 'cm' },
  ],
  getAnchors(props) {
    const h = num(props, 'height', 8);
    const anchors: AnchorDef[] = [
      {
        id: 'peg',
        kind: 'mount-peg',
        position: [0, -h / 2, 0],
        axis: [0, -1, 0],
        defaultConnection: 'fixed',
      },
      // Top bearing: a vertical axle can stand in the post.
      {
        id: 'bearing_top',
        kind: 'axle-socket',
        position: [0, h / 2, 0],
        axis: [0, 1, 0],
        defaultConnection: 'revolute',
      },
    ];
    // Bearing holes from 1 cm below the top, every 2 cm, leaving 1.5 cm at the base.
    let k = 0;
    for (let y = h / 2 - 1; y > -h / 2 + 1.5; y -= 2) {
      anchors.push({
        id: `bearing_${k++}`,
        kind: 'axle-socket',
        position: [0, y, 0],
        axis: [0, 0, 1],
        defaultConnection: 'revolute',
      });
    }
    return anchors;
  },
  buildGeometry(props) {
    const h = num(props, 'height', 8);
    const w = num(props, 'width', 1.6);
    const d = num(props, 'depth', 1.6);
    const peg = cylinderGeometry(0.35, 1, 16);
    return merged([
      { geometry: boxGeometry(w, h, d) },
      { geometry: peg, position: [0, -h / 2 - 0.3, 0] },
    ]);
  },
  buildColliders(props) {
    const h = num(props, 'height', 8);
    return [
      {
        shape: 'cuboid',
        halfExtents: [num(props, 'width', 1.6) / 2, h / 2, num(props, 'depth', 1.6) / 2],
        offset: IDENTITY,
      },
    ];
  },
  physical: () => ({ density: 0.0027, friction: 0.6, restitution: 0.2 }),
  visual: () => ({ color: '#8d99ae', metalness: 0.7, roughness: 0.4 }),
};
