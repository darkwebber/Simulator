import { cylinderGeometry, merged } from '@/geometry/primitives';
import type { PartDefinition } from '../partDefinition';
import { num } from '../partDefinition';

/**
 * Weighted cord: the multiplier of the mechanical MNIST classifier. A weight
 * of magnitude 1 is a plain cord from a feeler capstan to a score-rod drum;
 * magnitude 2 runs the same cord around a 2:1 movable pulley (drawn as a
 * doubled strand); the sign is which side of the drum it pulls (green lifts,
 * red lowers). A weight of 0 is a part that doesn't exist.
 *
 * Cords are pure transmission: the engine never builds a body for them — the
 * lacing becomes one weighted-sum coupling per score rod.
 */
export const cordCoupler: PartDefinition = {
  type: 'cordCoupler',
  label: 'Weighted cord',
  category: 'transmission',
  description:
    'Cord from a feeler capstan to a score-rod drum. Weight ±1 is a straight lacing, ' +
    '±2 adds a 2:1 pulley; the sign is the pull direction.',
  defaultProps: { weight: 1, length: 6 },
  propSchema: [
    { key: 'weight', label: 'Weight', type: 'number', min: -2, max: 2, step: 1, integer: true },
    { key: 'length', label: 'Length', type: 'number', min: 1, max: 60, step: 0.5, unit: 'cm' },
  ],
  getAnchors(props) {
    const len = num(props, 'length', 6);
    return [
      {
        id: 'endA',
        kind: 'spring-eye',
        position: [0, -len / 2, 0],
        axis: [0, -1, 0],
        defaultConnection: 'cord',
      },
      {
        id: 'endB',
        kind: 'spring-eye',
        position: [0, len / 2, 0],
        axis: [0, 1, 0],
        defaultConnection: 'cord',
      },
    ];
  },
  buildGeometry(props) {
    const len = num(props, 'length', 6);
    const double = Math.abs(num(props, 'weight', 1)) >= 2;
    const pieces: Parameters<typeof merged>[0] = [];
    if (double) {
      pieces.push({ geometry: cylinderGeometry(0.045, len, 6), position: [0.08, 0, 0] });
      pieces.push({ geometry: cylinderGeometry(0.045, len, 6), position: [-0.08, 0, 0] });
      // The 2:1 movable pulley, mid-cord.
      pieces.push({ geometry: cylinderGeometry(0.28, 0.18, 12), position: [0, 0, 0] });
    } else {
      pieces.push({ geometry: cylinderGeometry(0.05, len, 6) });
    }
    // End ferrules.
    pieces.push({ geometry: cylinderGeometry(0.12, 0.3, 8), position: [0, -len / 2 + 0.15, 0] });
    pieces.push({ geometry: cylinderGeometry(0.12, 0.3, 8), position: [0, len / 2 - 0.15, 0] });
    return merged(pieces);
  },
  // Laced cords never become bodies (the engine consumes them as couplings);
  // the collider only matters for a loose cord dropped in the scene.
  buildColliders(props) {
    return [
      {
        shape: 'cylinder',
        halfHeight: num(props, 'length', 6) / 2,
        radius: 0.12,
        offset: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
      },
    ];
  },
  physical: () => ({ density: 0.0005, friction: 0.4, restitution: 0 }),
  visual: (props) => ({
    color: num(props, 'weight', 1) >= 0 ? '#46b079' : '#c0504d',
    metalness: 0.1,
    roughness: 0.7,
  }),
  simTags: ['cord'],
};
