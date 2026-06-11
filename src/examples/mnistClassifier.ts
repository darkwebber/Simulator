/** Bundled example: the mechanical MNIST classifier, assembled in the
 * workspace the way the quasi-static simulator on main describes it:
 *
 *   punched card → feeler columns → weighted cords → score rods → falling bar
 *
 *   · The card sits in its press frame; a feeler column over each 4×4 block
 *     turns its capstan in proportion to the block's hole count (0–16) —
 *     pooling by stacking, condensed into one part.
 *   · Every nonzero trained weight is a cord from a feeler capstan to a score
 *     rod's drum: |w| = 1 is a straight lacing, |w| = 2 runs round a 2:1
 *     pulley, the sign is the side it pulls. Zero weights are cords that were
 *     never built (245 of 490 exist).
 *   · Each digit's score rod slides in a guide; its height IS the score:
 *       y = feed · Σ w·θ + rest height,
 *     the bias set as rest cord length at assembly and a machine-wide LIFT
 *     keeping every rod above its stop for any card.
 *   · A bar slides straight down over the rods and settles on the tallest —
 *     argmax by gravity. The rod it lands on names the digit.
 *
 * Scale: UNIT_ANGLE = 0.4 rad per hole, FEED = 0.075 cm/rad, so one score
 * unit = 0.03 cm of rod travel and the worst-case lifted score (797) is
 * 23.9 cm — set ROD_TOP_BASE accordingly and the machine handles any card.
 */

import type {
  ConnectionInstance,
  MachineDocument,
  PartInstance,
  Quat,
  Vec3,
} from '@/model/types';
import { qFromUnitVectors, vDistance, vNormalize, vSub } from '@/model/math';
import { BIAS, LIFT, SAMPLE_CARDS, WEIGHTS, cardBits, poolCounts } from './mnistData';

const ID: Quat = [0, 0, 0, 1];

const CELL = 0.55;
const UNIT_ANGLE = 0.4; // rad of capstan per hole
const FEED = 0.075; // cm of rod travel per rad per unit weight
const CM_PER_UNIT = UNIT_ANGLE * FEED; // 0.03 cm per score unit

const CARD_Z = 16;
const CARD_TOP = 1.1;
const FEELER_Y = 1.7;
const CAPSTAN_Y = FEELER_Y + 0.85;

const ROD_Z = -18;
const ROD_LEN = 12;
const ROD_TOP_BASE = 6; // rod top at lifted score 0
const ROD_X0 = -22.5;
const ROD_DX = 5;
const GUIDE_Z = -21;
const GUIDE_H = 12;
const FAIRLEAD_Y = 0.5 + GUIDE_H + 0.7; // cords aim at the guide post top

const BAR_START_Y = 31; // above the worst-case tallest rod (≈24.4)

export function mnistClassifierDemo(sampleIndex = 9): MachineDocument {
  const sample = SAMPLE_CARDS[Math.max(0, Math.min(SAMPLE_CARDS.length - 1, sampleIndex))];
  const pattern = cardBits(sample.hex);
  const counts = poolCounts(pattern);

  const parts: PartInstance[] = [];
  const conns: ConnectionInstance[] = [];
  let cid = 0;

  const connect = (
    kind: ConnectionInstance['kind'],
    aRef: ConnectionInstance['a'],
    bRef: ConnectionInstance['b'],
    props: ConnectionInstance['props'] = {},
  ) => {
    conns.push({ id: `c${cid++}`, kind, a: aRef, b: bRef, props });
  };
  const part = (p: PartInstance) => {
    parts.push(p);
    return p.id;
  };

  part({
    id: 'plate',
    type: 'baseplate',
    name: 'Baseplate',
    props: { width: 100, depth: 64, thickness: 1, holeSpacing: 4 },
    transform: { position: [0, 0, 0], rotation: ID },
  });
  const bolt = (partId: string, anchorId = 'peg') =>
    connect('fixed', { partId, anchorId }, { partId: 'plate', anchorId: 'hole_0_0' });

  // --- Stage 1 · punched card in its press frame -----------------------------
  part({
    id: 'card',
    type: 'punchedCard',
    name: `Punched card — MNIST test #${sample.testIndex} (digit ${sample.label})`,
    props: { pattern, cell: CELL },
    transform: { position: [0, CARD_TOP - 0.3, CARD_Z], rotation: ID },
  });
  bolt('card');

  // --- Stage 2 · 49 feeler columns over the card blocks ----------------------
  const feelerXZ: Array<[number, number]> = [];
  for (let br = 0; br < 7; br++) {
    for (let bc = 0; bc < 7; bc++) {
      const j = br * 7 + bc;
      const x = (bc * 4 - 12) * CELL;
      const z = CARD_Z + (br * 4 - 12) * CELL;
      feelerXZ.push([x, z]);
      part({
        id: `feeler_${j}`,
        type: 'feelerColumn',
        name: `Feeler ${br},${bc} (reads ${counts[j]} holes)`,
        props: { count: counts[j], unitAngle: UNIT_ANGLE, speed: 2.5, torque: 8000 },
        transform: { position: [x, FEELER_Y, z], rotation: ID },
      });
      connect(
        'revolute',
        { partId: `feeler_${j}`, anchorId: 'bore' },
        { partId: 'card', anchorId: `spindle_${br}_${bc}` },
      );
    }
  }

  // --- Stage 3 · score rods, their guides, and the cord loom -----------------
  for (let k = 0; k < 10; k++) {
    const x = ROD_X0 + k * ROD_DX;
    const restTop = ROD_TOP_BASE + CM_PER_UNIT * (BIAS[k] + LIFT); // bias = rest cord length

    part({
      id: `guide_${k}`,
      type: 'frameBeam',
      name: `Rod guide ${k}`,
      props: { height: GUIDE_H, width: 1.6, depth: 1.6 },
      transform: { position: [x, 0.5 + GUIDE_H / 2, GUIDE_Z], rotation: ID },
    });
    bolt(`guide_${k}`);

    part({
      id: `rod_${k}`,
      type: 'scoreRod',
      name: `Score rod ${k}`,
      props: { digit: k, length: ROD_LEN, radius: 0.5, feed: FEED },
      transform: { position: [x, restTop - ROD_LEN / 2, ROD_Z], rotation: ID },
    });
    connect(
      'prismatic',
      { partId: `rod_${k}`, anchorId: 'slide' },
      { partId: `guide_${k}`, anchorId: 'bearing_top' },
    );

    // The lacing: one cord per nonzero trained weight.
    for (let j = 0; j < 49; j++) {
      const w = WEIGHTS[k][j];
      if (w === 0) continue; // a zero weight is a part that doesn't exist
      const from: Vec3 = [feelerXZ[j][0], CAPSTAN_Y, feelerXZ[j][1]];
      const to: Vec3 = [x, FAIRLEAD_Y, GUIDE_Z];
      const length = vDistance(from, to);
      const dir = vNormalize(vSub(to, from));
      part({
        id: `cord_${k}_${j}`,
        type: 'cordCoupler',
        name: `Cord feeler ${Math.floor(j / 7)},${j % 7} → rod ${k} (w=${w > 0 ? '+' : ''}${w})`,
        props: { weight: w, length },
        transform: {
          position: [
            (from[0] + to[0]) / 2,
            (from[1] + to[1]) / 2,
            (from[2] + to[2]) / 2,
          ],
          rotation: qFromUnitVectors([0, 1, 0], dir),
        },
      });
      connect('cord', { partId: `cord_${k}_${j}`, anchorId: 'endA' }, { partId: `feeler_${j}`, anchorId: 'capstan' });
      connect('cord', { partId: `cord_${k}_${j}`, anchorId: 'endB' }, { partId: `rod_${k}`, anchorId: 'drum' });
    }
  }

  // --- Stage 4 · argmax by gravity -------------------------------------------
  for (const [id, x] of [
    ['barpost_R', 29],
    ['barpost_L', -29],
  ] as const) {
    part({
      id,
      type: 'frameBeam',
      name: 'Falling-bar guide post',
      props: { height: BAR_START_Y - 0.5, width: 1.6, depth: 1.6 },
      transform: { position: [x, 0.5 + (BAR_START_Y - 0.5) / 2, ROD_Z], rotation: ID },
    });
    bolt(id);
  }
  part({
    id: 'bar',
    type: 'fallingBar',
    name: 'Falling bar (argmax)',
    props: { span: 54, thickness: 1.2, depth: 2.4 },
    transform: { position: [0, BAR_START_Y, ROD_Z], rotation: ID },
  });
  connect(
    'prismatic',
    { partId: 'bar', anchorId: 'slide' },
    { partId: 'barpost_R', anchorId: 'bearing_top' },
  );

  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    meta: {
      name: `MNIST classifier — test card #${sample.testIndex} (digit ${sample.label})`,
      createdAt: now,
      modifiedAt: now,
    },
    settings: { gravity: [0, -981, 0], gridSize: 0.5 },
    parts,
    connections: conns,
  };
}

/** Rod-top world height the machine must reach for a lifted score. */
export function rodTopForScore(lifted: number): number {
  return ROD_TOP_BASE + CM_PER_UNIT * lifted;
}
