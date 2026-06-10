import { springGeometry } from '@/geometry/primitives';
import type { PartDefinition } from '../partDefinition';
import { num } from '../partDefinition';

/**
 * Coil spring along local +Y. When both eyes are connected, the engine
 * replaces it with a Rapier spring joint between the connected bodies and the
 * helix is drawn stretched between the live anchor points. Unconnected
 * springs are ordinary loose rigid bodies.
 */
export const spring: PartDefinition = {
  type: 'spring',
  label: 'Spring',
  category: 'mechanism',
  description: 'Linear coil spring. Connect both eyes to pegs or holes.',
  defaultProps: { stiffness: 300, damping: 8, restLength: 6, coilRadius: 0.8 },
  propSchema: [
    { key: 'stiffness', label: 'Stiffness', type: 'number', min: 10, max: 10000, step: 10, unit: 'kg/s²' },
    { key: 'damping', label: 'Damping', type: 'number', min: 0, max: 200, step: 1 },
    { key: 'restLength', label: 'Rest length', type: 'number', min: 2, max: 30, step: 0.5, unit: 'cm' },
    { key: 'coilRadius', label: 'Coil radius', type: 'number', min: 0.3, max: 3, step: 0.1, unit: 'cm' },
  ],
  getAnchors(props) {
    const len = num(props, 'restLength', 6);
    return [
      {
        id: 'eyeA',
        kind: 'spring-eye',
        position: [0, -len / 2, 0],
        axis: [0, -1, 0],
        defaultConnection: 'fixed',
      },
      {
        id: 'eyeB',
        kind: 'spring-eye',
        position: [0, len / 2, 0],
        axis: [0, 1, 0],
        defaultConnection: 'fixed',
      },
    ];
  },
  buildGeometry(props) {
    return springGeometry(
      num(props, 'coilRadius', 0.8),
      0.15,
      num(props, 'restLength', 6),
    );
  },
  buildColliders(props) {
    return [
      {
        shape: 'cylinder',
        halfHeight: num(props, 'restLength', 6) / 2,
        radius: num(props, 'coilRadius', 0.8) + 0.15,
        offset: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
      },
    ];
  },
  physical: () => ({ density: 0.001, friction: 0.5, restitution: 0.3 }),
  visual: () => ({ color: '#c84b31', metalness: 0.75, roughness: 0.45 }),
  simTags: ['spring'],
};
