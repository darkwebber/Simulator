import { boxGeometry, cylinderGeometry, merged } from '@/geometry/primitives';
import type { PartDefinition } from '../partDefinition';
import { num } from '../partDefinition';

/**
 * Pooling follower of the mechanical MNIST classifier. In the full machine
 * the 16 feeler pins of a 4×4 card block drop through the holes and pile up
 * in a channel; the follower rides the pile, so its travel IS the hole count.
 * This part condenses pins + channel + follower into one column: a servo
 * (the pin stack) turns its capstan by `count` × `unitAngle`, and cords laced
 * from the capstan carry the count into the scoring loom.
 *
 * `count` is set by the card press when a card is loaded — or by hand in the
 * Inspector, which is exactly like punching the block yourself.
 */
export const feelerColumn: PartDefinition = {
  type: 'feelerColumn',
  label: 'Feeler column',
  category: 'mechanism',
  description:
    'Pooling follower: turns its capstan in proportion to the hole count (0–16) of the ' +
    'card block under it. Lace cords from the capstan to score-rod drums.',
  defaultProps: { count: 0, unitAngle: 0.4, speed: 2.5, torque: 8000 },
  propSchema: [
    { key: 'count', label: 'Hole count', type: 'number', min: 0, max: 16, step: 1, integer: true },
    { key: 'unitAngle', label: 'Angle per hole', type: 'number', min: 0.1, max: 1, step: 0.05, unit: 'rad' },
    { key: 'speed', label: 'Read speed', type: 'number', min: 0.5, max: 20, step: 0.5, unit: 'rad/s' },
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
      },
      {
        id: 'capstan',
        kind: 'spring-eye',
        position: [0, 0.85, 0],
        axis: [0, 1, 0],
        defaultConnection: 'cord',
      },
    ];
  },
  servoTarget(props) {
    return num(props, 'count', 0) * num(props, 'unitAngle', 0.4);
  },
  buildGeometry() {
    return merged([
      { geometry: cylinderGeometry(0.85, 0.45, 24), position: [0, 0, 0] },
      { geometry: cylinderGeometry(0.3, 0.7, 16), position: [0, 0.55, 0] },
    ]);
  },
  // Pointer arm so the read count is visible as a dial angle.
  buildAccentGeometry() {
    return merged([
      { geometry: boxGeometry(0.7, 0.18, 0.22), position: [0.5, 0.31, 0] },
      { geometry: cylinderGeometry(0.12, 0.2, 10), position: [0, 0.95, 0] },
    ]);
  },
  accentColor: () => '#f2ead9',
  buildColliders() {
    return [
      {
        shape: 'cylinder',
        halfHeight: 0.45,
        radius: 0.85,
        offset: { position: [0, 0.2, 0], rotation: [0, 0, 0, 1] },
      },
    ];
  },
  physical: () => ({ density: 0.003, friction: 0.5, restitution: 0.1 }),
  // Shade with the count so a loaded card reads at a glance (dark = 0 holes).
  visual: (props) => {
    const t = Math.max(0, Math.min(1, num(props, 'count', 0) / 16));
    const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
    const ch = (v: number) => v.toString(16).padStart(2, '0');
    return {
      color: `#${ch(mix(0x3a, 0xe3))}${ch(mix(0x3f, 0xb3))}${ch(mix(0x46, 0x41))}`,
      metalness: 0.5,
      roughness: 0.5,
    };
  },
  simTags: ['servo'],
};
