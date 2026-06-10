import { buildGearGeometry } from '@/geometry/gearGeometry';
import { gearDims } from '@/geometry/gearProfile';
import type { PartDefinition } from '../partDefinition';
import { IDENTITY, bool, num } from '../partDefinition';

/**
 * Involute spur gear, axis local +Y. Users edit teeth count and module —
 * radius is derived (r = m·N/2), which guarantees same-module gears mesh.
 * Meshing with neighbors is inferred geometrically at simulation build time.
 */
export const spurGear: PartDefinition = {
  type: 'spurGear',
  label: 'Spur gear',
  category: 'transmission',
  description: 'Involute spur gear. Position two same-module gears rim-to-rim to mesh them.',
  defaultProps: { teeth: 16, module: 0.5, width: 1, bore: 0.4, keyed: true },
  propSchema: [
    { key: 'teeth', label: 'Teeth', type: 'number', min: 6, max: 96, step: 1, integer: true },
    { key: 'module', label: 'Module', type: 'number', min: 0.25, max: 1.5, step: 0.05, unit: 'cm' },
    { key: 'width', label: 'Face width', type: 'number', min: 0.4, max: 4, step: 0.2, unit: 'cm' },
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
    return buildGearGeometry(
      Math.round(num(props, 'teeth', 16)),
      num(props, 'module', 0.5),
      num(props, 'width', 1),
      num(props, 'bore', 0.4),
    );
  },
  buildColliders(props) {
    const dims = gearDims(Math.round(num(props, 'teeth', 16)), num(props, 'module', 0.5));
    // Collider stops at the root circle: meshed gears never collide — the
    // coupling constraint transmits the motion instead.
    return [
      {
        shape: 'cylinder',
        halfHeight: num(props, 'width', 1) / 2,
        radius: dims.rRoot,
        offset: IDENTITY,
      },
    ];
  },
  physical: () => ({ density: 0.0085, friction: 0.4, restitution: 0.1 }),
  visual: () => ({ color: '#d4a017', metalness: 0.85, roughness: 0.35 }),
  simTags: ['gear'],
};
