import { boxGeometry, merged, cylinderGeometry } from '@/geometry/primitives';
import type { PartDefinition } from '../partDefinition';
import { num } from '../partDefinition';

/** Fixed reading needle: a post with a knife-edge blade on its −Z side.
 * Place it beside an indicator drum stack to mark the read-out line. */
export const pointerMarker: PartDefinition = {
  type: 'pointerMarker',
  label: 'Pointer',
  category: 'mechanism',
  description: 'Fixed reading needle for dials and indicator drums.',
  defaultProps: { height: 18 },
  propSchema: [
    { key: 'height', label: 'Height', type: 'number', min: 3, max: 30, step: 1, unit: 'cm' },
  ],
  getAnchors(props) {
    const h = num(props, 'height', 18);
    return [
      {
        id: 'peg',
        kind: 'mount-peg',
        position: [0, -h / 2, 0],
        axis: [0, -1, 0],
        defaultConnection: 'fixed',
      },
    ];
  },
  buildGeometry(props) {
    const h = num(props, 'height', 18);
    const post = boxGeometry(0.6, h, 0.6);
    const blade = boxGeometry(0.12, h * 0.6, 1.2);
    const peg = cylinderGeometry(0.35, 1, 16);
    return merged([
      { geometry: post },
      { geometry: blade, position: [0, h * 0.2, -0.85] },
      { geometry: peg, position: [0, -h / 2 - 0.3, 0] },
    ]);
  },
  buildColliders(props) {
    const h = num(props, 'height', 18);
    return [
      {
        shape: 'cuboid',
        halfExtents: [0.3, h / 2, 0.3],
        offset: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
      },
    ];
  },
  physical: () => ({ density: 0.0027, friction: 0.5, restitution: 0.1 }),
  visual: () => ({ color: '#d8b13a', metalness: 0.7, roughness: 0.35 }),
};
