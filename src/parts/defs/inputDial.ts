import { boxGeometry, cylinderGeometry, merged } from '@/geometry/primitives';
import type { PartDefinition } from '../partDefinition';

/**
 * Operator's input dial: keyed onto an axle, it is turned by a built-in
 * position servo — the simulated "hand" — to 0° (value 0) or 180° (value 1).
 * Set the value in the Inspector, press Run, and the dial cranks the machine.
 * `reversed` flips the turn direction (0° and 180° look identical at rest,
 * so reversed dials read the same).
 */
export const inputDial: PartDefinition = {
  type: 'inputDial',
  label: 'Input dial',
  category: 'power',
  description:
    'Servo-turned dial: rotates its axle half a turn when value = 1. The way to feed numbers into a machine.',
  defaultProps: { value: false, reversed: false, speed: 5, torque: 50000 },
  propSchema: [
    { key: 'value', label: 'Value (1 = half turn)', type: 'boolean' },
    { key: 'reversed', label: 'Reversed', type: 'boolean' },
    { key: 'speed', label: 'Turn speed', type: 'number', min: 0.5, max: 20, step: 0.5, unit: 'rad/s' },
    { key: 'torque', label: 'Max torque', type: 'number', min: 100, max: 200000, step: 100, unit: 'kg·cm²/s²' },
  ],
  getAnchors() {
    return [
      {
        id: 'bore',
        kind: 'axle-socket',
        position: [0, 0, 0],
        axis: [0, 1, 0],
        defaultConnection: 'revolute',
        connectionProps: { keyed: true },
      },
    ];
  },
  buildGeometry() {
    const r = 1.8;
    const disc = cylinderGeometry(r, 0.5, 32);
    const pointer = boxGeometry(r - 0.2, 0.3, 0.5);
    const tip = cylinderGeometry(0.28, 0.32, 4); // diamond tip
    const knob = cylinderGeometry(0.45, 0.5, 16);
    return merged([
      { geometry: disc },
      { geometry: pointer, position: [(r - 0.2) / 2 + 0.2, 0.4, 0] },
      { geometry: tip, position: [r - 0.15, 0.4, 0] },
      { geometry: knob, position: [0, 0.5, 0] },
    ]);
  },
  buildColliders() {
    return [
      {
        shape: 'cylinder',
        halfHeight: 0.45,
        radius: 1.8,
        offset: { position: [0, 0.2, 0], rotation: [0, 0, 0, 1] },
      },
    ];
  },
  physical: () => ({ density: 0.003, friction: 0.5, restitution: 0.1 }),
  visual: (props) => ({
    color: props.value === true ? '#3fae6a' : '#b3553f',
    metalness: 0.5,
    roughness: 0.5,
  }),
  simTags: ['servo'],
};
