import { boxGeometry, cylinderGeometry, merged } from '@/geometry/primitives';
import type { PartDefinition } from '../partDefinition';
import { num } from '../partDefinition';

/**
 * Argmax by gravity: a bar guided to slide straight down (one prismatic
 * bearing, no tilt) drops over the row of score rods and settles on the
 * tallest — real contact, no comparator logic. The rod it rests on names the
 * machine's answer.
 */
export const fallingBar: PartDefinition = {
  type: 'fallingBar',
  label: 'Falling bar',
  category: 'mechanism',
  description:
    'Gravity argmax: slides straight down a prismatic guide and settles on the tallest ' +
    'score rod beneath it.',
  defaultProps: { span: 54, thickness: 1.2, depth: 2.4 },
  propSchema: [
    { key: 'span', label: 'Span', type: 'number', min: 8, max: 80, step: 1, unit: 'cm' },
    { key: 'thickness', label: 'Thickness', type: 'number', min: 0.6, max: 3, step: 0.2, unit: 'cm' },
    { key: 'depth', label: 'Depth', type: 'number', min: 1, max: 6, step: 0.2, unit: 'cm' },
  ],
  getAnchors() {
    return [
      {
        id: 'slide',
        kind: 'axle-socket',
        position: [0, 0, 0],
        axis: [0, 1, 0],
        defaultConnection: 'prismatic',
      },
    ];
  },
  buildGeometry(props) {
    return boxGeometry(
      num(props, 'span', 54),
      num(props, 'thickness', 1.2),
      num(props, 'depth', 2.4),
    );
  },
  // End caps so the bar reads as a finished piece of hardware.
  buildAccentGeometry(props) {
    const span = num(props, 'span', 54);
    const t = num(props, 'thickness', 1.2);
    return merged([
      { geometry: cylinderGeometry(t * 0.7, t * 1.1, 16), position: [-span / 2, 0, 0] },
      { geometry: cylinderGeometry(t * 0.7, t * 1.1, 16), position: [span / 2, 0, 0] },
    ]);
  },
  accentColor: () => '#8a5a44',
  buildColliders(props) {
    return [
      {
        shape: 'cuboid',
        halfExtents: [
          num(props, 'span', 54) / 2,
          num(props, 'thickness', 1.2) / 2,
          num(props, 'depth', 2.4) / 2,
        ],
        offset: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
      },
    ];
  },
  // Featherweight: the bar must read the tallest rod, not depress it.
  physical: () => ({ density: 0.0002, friction: 0.5, restitution: 0 }),
  visual: () => ({ color: '#b3553f', metalness: 0.5, roughness: 0.5 }),
};
