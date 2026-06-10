import { boxGeometry } from '@/geometry/primitives';
import type { AnchorDef, PartDefinition } from '../partDefinition';
import { IDENTITY, num } from '../partDefinition';

export const baseplate: PartDefinition = {
  type: 'baseplate',
  label: 'Baseplate',
  category: 'structure',
  description: 'Fixed work surface with a grid of mounting holes.',
  defaultProps: { width: 24, depth: 24, thickness: 1, holeSpacing: 2 },
  propSchema: [
    { key: 'width', label: 'Width', type: 'number', min: 4, max: 100, step: 1, unit: 'cm' },
    { key: 'depth', label: 'Depth', type: 'number', min: 4, max: 100, step: 1, unit: 'cm' },
    { key: 'thickness', label: 'Thickness', type: 'number', min: 0.5, max: 4, step: 0.5, unit: 'cm' },
    { key: 'holeSpacing', label: 'Hole spacing', type: 'number', min: 1, max: 4, step: 0.5, unit: 'cm' },
  ],
  getAnchors(props) {
    const w = num(props, 'width', 24);
    const d = num(props, 'depth', 24);
    const t = num(props, 'thickness', 1);
    const s = num(props, 'holeSpacing', 2);
    const anchors: AnchorDef[] = [];
    const nx = Math.floor((w - s) / s);
    const nz = Math.floor((d - s) / s);
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= nz; j++) {
        const x = -((nx * s) / 2) + i * s;
        const z = -((nz * s) / 2) + j * s;
        anchors.push({
          id: `hole_${i}_${j}`,
          kind: 'mount-hole',
          position: [x, t / 2, z],
          axis: [0, 1, 0],
          defaultConnection: 'fixed',
        });
      }
    }
    return anchors;
  },
  buildGeometry(props) {
    return boxGeometry(
      num(props, 'width', 24),
      num(props, 'thickness', 1),
      num(props, 'depth', 24),
    );
  },
  buildColliders(props) {
    return [
      {
        shape: 'cuboid',
        halfExtents: [
          num(props, 'width', 24) / 2,
          num(props, 'thickness', 1) / 2,
          num(props, 'depth', 24) / 2,
        ],
        offset: IDENTITY,
      },
    ];
  },
  physical: () => ({ density: 0.0078, friction: 0.8, restitution: 0.1 }),
  visual: () => ({ color: '#3a4750', metalness: 0.3, roughness: 0.75 }),
  isStatic: () => true,
};
