import { boxGeometry, cylinderGeometry, merged } from '@/geometry/primitives';
import type { PartDefinition } from '../partDefinition';
import { num } from '../partDefinition';

/**
 * Hinge bracket: a base that pegs into mounting holes and a fixed pin across
 * the top. Snap a frame post's bearing hole onto the pin to make a lever.
 * Pin axis is local +X.
 */
export const hinge: PartDefinition = {
  type: 'hinge',
  label: 'Hinge bracket',
  category: 'mechanism',
  description: 'Mounted bracket with a pivot pin — the basis of levers and flippers.',
  defaultProps: { pinHeight: 2, pinLength: 2.4 },
  propSchema: [
    { key: 'pinHeight', label: 'Pin height', type: 'number', min: 1, max: 8, step: 0.5, unit: 'cm' },
    { key: 'pinLength', label: 'Pin length', type: 'number', min: 1.2, max: 6, step: 0.4, unit: 'cm' },
  ],
  getAnchors(props) {
    const h = num(props, 'pinHeight', 2);
    return [
      {
        id: 'peg',
        kind: 'mount-peg',
        position: [0, 0, 0],
        axis: [0, -1, 0],
        defaultConnection: 'fixed',
      },
      {
        id: 'pin',
        kind: 'axle-shaft',
        position: [0, h, 0],
        axis: [1, 0, 0],
        defaultConnection: 'revolute',
      },
    ];
  },
  buildGeometry(props) {
    const h = num(props, 'pinHeight', 2);
    const pinLen = num(props, 'pinLength', 2.4);
    const base = boxGeometry(2, 0.5, 2);
    const column = boxGeometry(0.8, h, 0.8);
    const pin = cylinderGeometry(0.35, pinLen, 16);
    pin.rotateZ(Math.PI / 2); // cylinder Y → X
    const peg = cylinderGeometry(0.35, 1, 16);
    return merged([
      { geometry: base, position: [0, 0.25, 0] },
      { geometry: column, position: [0, h / 2, 0] },
      { geometry: pin, position: [0, h, 0] },
      { geometry: peg, position: [0, -0.3, 0] },
    ]);
  },
  buildColliders(props) {
    const h = num(props, 'pinHeight', 2);
    return [
      {
        shape: 'cuboid',
        halfExtents: [1, 0.25, 1],
        offset: { position: [0, 0.25, 0], rotation: [0, 0, 0, 1] },
      },
      {
        shape: 'cuboid',
        halfExtents: [0.4, h / 2, 0.4],
        offset: { position: [0, h / 2, 0], rotation: [0, 0, 0, 1] },
      },
    ];
  },
  physical: () => ({ density: 0.0078, friction: 0.5, restitution: 0.1 }),
  visual: () => ({ color: '#6d7b8a', metalness: 0.8, roughness: 0.35 }),
};
