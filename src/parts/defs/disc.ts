import { cylinderGeometry } from '@/geometry/primitives';
import type { PartDefinition } from '../partDefinition';
import { IDENTITY, bool, num } from '../partDefinition';

/** Plain disc — flywheel, roller, cam blank or loose weight. Axis local +Y. */
export const disc: PartDefinition = {
  type: 'disc',
  label: 'Disc',
  category: 'transmission',
  description: 'Solid disc: flywheel, roller or weight.',
  defaultProps: { radius: 3, thickness: 1, bore: 0.4, keyed: true },
  propSchema: [
    { key: 'radius', label: 'Radius', type: 'number', min: 0.5, max: 12, step: 0.5, unit: 'cm' },
    { key: 'thickness', label: 'Thickness', type: 'number', min: 0.2, max: 6, step: 0.2, unit: 'cm' },
    { key: 'bore', label: 'Bore radius', type: 'number', min: 0.2, max: 1, step: 0.05, unit: 'cm' },
    { key: 'keyed', label: 'Keyed to axle', type: 'boolean' },
  ],
  getAnchors(props) {
    return [
      {
        id: 'bore',
        kind: 'axle-socket',
        position: [0, 0, 0],
        axis: [0, 1, 0],
        defaultConnection: 'revolute',
        connectionProps: { keyed: bool(props, 'keyed', true) },
      },
    ];
  },
  buildGeometry(props) {
    return cylinderGeometry(num(props, 'radius', 3), num(props, 'thickness', 1), 40);
  },
  buildColliders(props) {
    return [
      {
        shape: 'cylinder',
        halfHeight: num(props, 'thickness', 1) / 2,
        radius: num(props, 'radius', 3),
        offset: IDENTITY,
      },
    ];
  },
  physical: () => ({ density: 0.0078, friction: 0.6, restitution: 0.25 }),
  visual: () => ({ color: '#a8b2bd', metalness: 0.8, roughness: 0.3 }),
};
