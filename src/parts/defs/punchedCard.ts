import { boxGeometry, cylinderGeometry, merged } from '@/geometry/primitives';
import type { AnchorDef, PartDefinition, PartProps } from '../partDefinition';
import { IDENTITY, num, str } from '../partDefinition';

/**
 * Punched card + card-press frame, the input stage of the mechanical MNIST
 * classifier. The card is a 28×28 grid of hole positions (a punched hole is a
 * dark pit); the frame above each 4×4 block carries a spindle on which a
 * feeler column rides. `pattern` is the 784-character row-major '0'/'1'
 * punching — set when the card is pressed, not edited by hand.
 */

export const CARD_PIXELS = 28;
export const CARD_BLOCK = 4;
export const CARD_BLOCKS = CARD_PIXELS / CARD_BLOCK; // 7

export function cardCell(props: PartProps): number {
  return num(props, 'cell', 0.55);
}

export function cardPattern(props: PartProps): string {
  const p = str(props, 'pattern', '');
  return p.length === CARD_PIXELS * CARD_PIXELS ? p : '0'.repeat(CARD_PIXELS * CARD_PIXELS);
}

/** Part-local x/z of a pixel center (row-major, row → +z, col → +x). */
export function cardPixelXZ(props: PartProps, row: number, col: number): [number, number] {
  const cell = cardCell(props);
  return [(col - (CARD_PIXELS - 1) / 2) * cell, (row - (CARD_PIXELS - 1) / 2) * cell];
}

/** Part-local x/z of a 4×4 block center. */
export function cardBlockXZ(props: PartProps, blockRow: number, blockCol: number): [number, number] {
  const cell = cardCell(props);
  const c = (CARD_PIXELS - 1) / 2;
  return [
    (blockCol * CARD_BLOCK + (CARD_BLOCK - 1) / 2 - c) * cell,
    (blockRow * CARD_BLOCK + (CARD_BLOCK - 1) / 2 - c) * cell,
  ];
}

const THICKNESS = 0.6;

export const punchedCard: PartDefinition = {
  type: 'punchedCard',
  label: 'Punched card',
  category: 'structure',
  description:
    '28×28 punched card in its press frame: holes are dark pits, and a spindle over ' +
    'each 4×4 block mounts a feeler column that reads the block’s hole count.',
  defaultProps: { pattern: '0'.repeat(CARD_PIXELS * CARD_PIXELS), cell: 0.55 },
  propSchema: [
    { key: 'cell', label: 'Hole pitch', type: 'number', min: 0.3, max: 1.2, step: 0.05, unit: 'cm' },
  ],
  getAnchors(props) {
    const anchors: AnchorDef[] = [
      {
        id: 'peg',
        kind: 'mount-peg',
        position: [0, -THICKNESS / 2, 0],
        axis: [0, -1, 0],
        defaultConnection: 'fixed',
      },
    ];
    for (let br = 0; br < CARD_BLOCKS; br++) {
      for (let bc = 0; bc < CARD_BLOCKS; bc++) {
        const [x, z] = cardBlockXZ(props, br, bc);
        anchors.push({
          id: `spindle_${br}_${bc}`,
          kind: 'axle-socket',
          position: [x, THICKNESS / 2, z],
          axis: [0, 1, 0],
          defaultConnection: 'revolute',
        });
      }
    }
    return anchors;
  },
  buildGeometry(props) {
    const size = CARD_PIXELS * cardCell(props) + 1.2;
    return boxGeometry(size, THICKNESS, size);
  },
  // Punched holes (dark pits on the card face) + the 49 spindle bosses.
  buildAccentGeometry(props) {
    const pattern = cardPattern(props);
    const cell = cardCell(props);
    const pieces: Parameters<typeof merged>[0] = [];
    for (let r = 0; r < CARD_PIXELS; r++) {
      for (let c = 0; c < CARD_PIXELS; c++) {
        if (pattern[r * CARD_PIXELS + c] !== '1') continue;
        const [x, z] = cardPixelXZ(props, r, c);
        pieces.push({
          geometry: cylinderGeometry(cell * 0.32, 0.1, 8),
          position: [x, THICKNESS / 2, z],
        });
      }
    }
    for (let br = 0; br < CARD_BLOCKS; br++) {
      for (let bc = 0; bc < CARD_BLOCKS; bc++) {
        const [x, z] = cardBlockXZ(props, br, bc);
        pieces.push({
          geometry: cylinderGeometry(0.18, 0.5, 10),
          position: [x, THICKNESS / 2 + 0.2, z],
        });
      }
    }
    return merged(pieces);
  },
  accentColor: () => '#1d2126',
  buildColliders(props) {
    const size = CARD_PIXELS * cardCell(props) + 1.2;
    return [
      { shape: 'cuboid', halfExtents: [size / 2, THICKNESS / 2, size / 2], offset: IDENTITY },
    ];
  },
  physical: () => ({ density: 0.002, friction: 0.6, restitution: 0.1 }),
  visual: () => ({ color: '#ded3ae', metalness: 0.05, roughness: 0.85 }),
};
