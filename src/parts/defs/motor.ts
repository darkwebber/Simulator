import { boxGeometry, cylinderGeometry, merged } from '@/geometry/primitives';
import type { PartDefinition } from '../partDefinition';
import { IDENTITY, num } from '../partDefinition';

/**
 * Motor with a coupling socket on top (local +Y). Insert an axle end into the
 * coupling; the engine drives that revolute connection as a velocity motor
 * with a hard torque clamp, so it genuinely stalls under excessive load.
 */
export const motor: PartDefinition = {
  type: 'motor',
  label: 'Motor',
  category: 'power',
  description: 'Velocity-controlled motor with limited torque. Couples to an axle end.',
  defaultProps: { speed: 30, maxTorque: 20000, reversed: false },
  propSchema: [
    { key: 'speed', label: 'Speed', type: 'number', min: 0, max: 300, step: 1, unit: 'rpm' },
    { key: 'maxTorque', label: 'Max torque', type: 'number', min: 100, max: 200000, step: 100, unit: 'kg·cm²/s²' },
    { key: 'reversed', label: 'Reversed', type: 'boolean' },
  ],
  getAnchors() {
    return [
      {
        id: 'peg',
        kind: 'mount-peg',
        position: [0, -1.5, 0],
        axis: [0, -1, 0],
        defaultConnection: 'fixed',
      },
      {
        id: 'output',
        kind: 'axle-socket',
        position: [0, 2.1, 0],
        axis: [0, 1, 0],
        defaultConnection: 'revolute',
        connectionProps: { motor: true },
      },
    ];
  },
  buildGeometry() {
    const housing = boxGeometry(3, 3, 3);
    const peg = cylinderGeometry(0.35, 1, 16);
    return merged([{ geometry: housing }, { geometry: peg, position: [0, -1.8, 0] }]);
  },
  // Output coupling in brass so the drive end is obvious.
  buildAccentGeometry() {
    return merged([
      { geometry: cylinderGeometry(0.7, 1.2, 24), position: [0, 2.1, 0] },
      { geometry: cylinderGeometry(0.5, 0.2, 24), position: [0, 1.6, 0] },
    ]);
  },
  accentColor: () => '#c9a14f',
  buildColliders() {
    return [
      { shape: 'cuboid', halfExtents: [1.5, 1.5, 1.5], offset: IDENTITY },
      {
        shape: 'cylinder',
        halfHeight: 0.6,
        radius: 0.7,
        offset: { position: [0, 2.1, 0], rotation: [0, 0, 0, 1] },
      },
    ];
  },
  physical: () => ({ density: 0.004, friction: 0.6, restitution: 0.1 }),
  visual: () => ({ color: '#2e6e4e', metalness: 0.6, roughness: 0.5 }),
  simTags: ['motor'],
};

export function motorTargetSpeedRad(props: Record<string, unknown>): number {
  const rpm = num(props as never, 'speed', 30);
  const reversed = props['reversed'] === true;
  return ((reversed ? -1 : 1) * rpm * 2 * Math.PI) / 60;
}
