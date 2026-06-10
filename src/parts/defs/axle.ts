import { cylinderGeometry } from '@/geometry/primitives';
import type { AnchorDef, PartDefinition } from '../partDefinition';
import { IDENTITY, num } from '../partDefinition';

/** Shaft along local +Y. Gears/discs slide onto shaft anchors; the shaft ends
 * ride in post bearings or insert into a motor coupling. */
export const axle: PartDefinition = {
  type: 'axle',
  label: 'Axle',
  category: 'transmission',
  description: 'Round shaft that carries gears and discs.',
  defaultProps: { length: 8, radius: 0.4 },
  propSchema: [
    { key: 'length', label: 'Length', type: 'number', min: 2, max: 40, step: 1, unit: 'cm' },
    { key: 'radius', label: 'Radius', type: 'number', min: 0.2, max: 1, step: 0.05, unit: 'cm' },
  ],
  getAnchors(props) {
    const len = num(props, 'length', 8);
    const anchors: AnchorDef[] = [];
    const step = 1;
    const count = Math.floor(len / step);
    for (let k = 0; k <= count; k++) {
      const y = -len / 2 + k * step;
      anchors.push({
        id: `shaft_${k}`,
        kind: 'axle-shaft',
        position: [0, Math.min(y, len / 2), 0],
        axis: [0, 1, 0],
        defaultConnection: 'revolute',
      });
    }
    return anchors;
  },
  buildGeometry(props) {
    return cylinderGeometry(num(props, 'radius', 0.4), num(props, 'length', 8), 20);
  },
  buildColliders(props) {
    return [
      {
        shape: 'cylinder',
        halfHeight: num(props, 'length', 8) / 2,
        radius: num(props, 'radius', 0.4),
        offset: IDENTITY,
      },
    ];
  },
  physical: () => ({ density: 0.0078, friction: 0.4, restitution: 0.1 }),
  visual: () => ({ color: '#c0c5ce', metalness: 0.9, roughness: 0.25 }),
};
