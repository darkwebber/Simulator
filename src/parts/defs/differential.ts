import { boxGeometry, cylinderGeometry, merged } from '@/geometry/primitives';
import type { PartDefinition } from '../partDefinition';
import { num } from '../partDefinition';

/**
 * Summing gearbox (sealed differential): three coupling sockets along the top
 * — two inputs and one output — with the internal gearing abstracted away.
 * The simulation enforces θ_out = θ_inA + θ_inB exactly, including
 * back-driving (hold the output and the inputs counter-rotate).
 *
 * This is the workhorse of mechanical analog computers: chains of these
 * compute weighted sums of shaft rotations.
 */
export const differential: PartDefinition = {
  type: 'differential',
  label: 'Differential (Σ)',
  category: 'mechanism',
  description:
    'Summing gearbox: output shaft rotation = input A + input B. Couple axles into its three sockets.',
  defaultProps: { spacing: 4 },
  propSchema: [
    {
      key: 'spacing',
      label: 'Coupling spacing',
      type: 'number',
      min: 3,
      max: 8,
      step: 0.5,
      unit: 'cm',
    },
  ],
  getAnchors(props) {
    const s = num(props, 'spacing', 4);
    return [
      {
        id: 'peg',
        kind: 'mount-peg',
        position: [0, -1.5, 0],
        axis: [0, -1, 0],
        defaultConnection: 'fixed',
      },
      {
        id: 'inA',
        kind: 'axle-socket',
        position: [-s, 2.1, 0],
        axis: [0, 1, 0],
        defaultConnection: 'revolute',
      },
      {
        id: 'inB',
        kind: 'axle-socket',
        position: [0, 2.1, 0],
        axis: [0, 1, 0],
        defaultConnection: 'revolute',
      },
      {
        id: 'out',
        kind: 'axle-socket',
        position: [s, 2.1, 0],
        axis: [0, 1, 0],
        defaultConnection: 'revolute',
      },
    ];
  },
  buildGeometry(props) {
    const s = num(props, 'spacing', 4);
    const body = boxGeometry(2 * s + 2.4, 3, 3);
    const peg = cylinderGeometry(0.35, 1, 16);
    return merged([{ geometry: body }, { geometry: peg, position: [0, -1.8, 0] }]);
  },
  // Coupling sleeves + emblem plate in brass — the working ends stand out.
  buildAccentGeometry(props) {
    const s = num(props, 'spacing', 4);
    const parts: Parameters<typeof merged>[0] = [];
    for (const x of [-s, 0, s]) {
      parts.push({ geometry: cylinderGeometry(0.7, 1.2, 24), position: [x, 2.1, 0] });
    }
    parts.push({ geometry: boxGeometry(1.6, 1.6, 0.15), position: [0, 0, 1.55] });
    return merged(parts);
  },
  accentColor: () => '#c9a14f',
  buildColliders(props) {
    const s = num(props, 'spacing', 4);
    const out: ReturnType<PartDefinition['buildColliders']> = [
      {
        shape: 'cuboid',
        halfExtents: [s + 1.2, 1.5, 1.5],
        offset: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
      },
    ];
    for (const x of [-s, 0, s]) {
      out.push({
        shape: 'cylinder',
        halfHeight: 0.6,
        radius: 0.7,
        offset: { position: [x, 2.1, 0], rotation: [0, 0, 0, 1] },
      });
    }
    return out;
  },
  physical: () => ({ density: 0.005, friction: 0.6, restitution: 0.1 }),
  visual: () => ({ color: '#5a4fa0', metalness: 0.55, roughness: 0.45 }),
  simTags: ['differential'],
};
