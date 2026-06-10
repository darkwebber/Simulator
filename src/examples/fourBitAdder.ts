/** Bundled example: a mechanical 4-bit adder.
 *
 * Principle (the classic mechanical-analog-computer way):
 *   · Every input bit is a servo-turned dial: value 1 = half a turn (π).
 *   · A differential gearbox per bit column sums the two input dials:
 *       S_k = A_k + B_k.
 *   · A Horner chain of differentials and 2:1 gear doublings accumulates
 *       V = ((2·S₃ + S₂)·2 + S₁)·2 + S₀  =  Σ (A_k+B_k)·2^k  ∈ 0..30
 *     on one shaft — carries are literally rotations cascading down the chain.
 *   · A 16:1 reduction scales the result so 1 unit = 1/32 turn, and a tower
 *     of 32-sector encoder drums (bit 0..4 + decimal) displays it in binary.
 *
 * Geometry invariants (all checked by the engine integration test):
 *   couplings & bearings hold every shaft bottom at y = 4.1;
 *   gear mesh planes: plane1 y=8.1, plane2 y=10.1, transfer plane3 y=12.1;
 *   8T (r=2) ↔ 8T transfers at distance 4, 16T (r=4) ↔ 8T doublings at 6,
 *   8T ↔ 32T (r=8) reductions at 10.
 *
 * Mesh sign bookkeeping: every spur mesh reverses direction. Per input path
 * the net sign works out negative for bits 2 and 0, so those dials are
 * `reversed` — they turn the other way, which is invisible (0 and π land on
 * the same pose) but keeps every contribution positive at the drums.
 */

import type {
  ConnectionInstance,
  MachineDocument,
  PartInstance,
  Quat,
} from '@/model/types';

const ID: Quat = [0, 0, 0, 1];
/** −90° about Y: differential coupling row local +X → world +Z. */
const ROT_Y_NEG90: Quat = [0, -Math.SQRT1_2, 0, Math.SQRT1_2];

const BOTTOM = 4.1; // every shaft bottom (couplings, post top bearings)
const PLANE1 = 8.1;
const PLANE2 = 10.1;
const PLANE3 = 12.1;
const DIAL_Y = 13.1;

export function fourBitAdderDemo(a = 11, b = 7): MachineDocument {
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

  // --- Baseplate -----------------------------------------------------------
  part({
    id: 'plate',
    type: 'baseplate',
    name: 'Baseplate',
    props: { width: 80, depth: 44, thickness: 1, holeSpacing: 4 },
    transform: { position: [0, 0, 2], rotation: ID },
  });
  const bolt = (partId: string, anchorId = 'peg') =>
    connect('fixed', { partId, anchorId }, { partId: 'plate', anchorId: 'hole_0_0' });

  // --- Helpers -------------------------------------------------------------
  /** Vertical axle whose bottom sits at y=BOTTOM. Anchors: shaft_k at BOTTOM+k. */
  const axleAt = (id: string, name: string, x: number, z: number, length: number) =>
    part({
      id,
      type: 'axle',
      name,
      props: { length, radius: 0.4 },
      transform: { position: [x, BOTTOM + length / 2, z], rotation: ID },
    });

  /** Spur gear keyed onto an axle at a mesh plane. */
  const gearOn = (
    id: string,
    name: string,
    axleId: string,
    x: number,
    z: number,
    plane: number,
    teeth: number,
  ) => {
    part({
      id,
      type: 'spurGear',
      name,
      props: { teeth, module: 0.5, width: 1, bore: 0.4, keyed: true },
      transform: { position: [x, plane, z], rotation: ID },
    });
    connect(
      'revolute',
      { partId: id, anchorId: 'bore' },
      { partId: axleId, anchorId: `shaft_${Math.round(plane - BOTTOM)}` },
      { keyed: true },
    );
  };

  /** Axle bottom into a coupling socket / post bearing. */
  const holdShaft = (axleId: string, holderId: string, anchorId: string) =>
    connect('revolute', { partId: axleId, anchorId: 'shaft_0' }, { partId: holderId, anchorId });

  /** Differential, coupling row along Z: inA z−4, inB z, out z+4 (centered z). */
  const diffAlongZ = (id: string, name: string, x: number, z: number) => {
    part({
      id,
      type: 'differential',
      name,
      props: { spacing: 4 },
      transform: { position: [x, 2, z], rotation: ROT_Y_NEG90 },
    });
    bolt(id);
  };

  /** Differential, coupling row along X: inA x−4, inB x, out x+4. */
  const diffAlongX = (id: string, name: string, x: number, z: number) => {
    part({
      id,
      type: 'differential',
      name,
      props: { spacing: 4 },
      transform: { position: [x, 2, z], rotation: ID },
    });
    bolt(id);
  };

  const postAt = (id: string, name: string, x: number, z: number) => {
    part({
      id,
      type: 'frameBeam',
      name,
      props: { height: 3.6, width: 1.6, depth: 1.6 },
      transform: { position: [x, 0.5 + 1.8, z], rotation: ID },
    });
    bolt(id);
  };

  // --- Input columns: dials + per-bit differentials -------------------------
  // Stage columns left→right: bit 3, 2, 1, 0. The chain diffs live on z=0;
  // bit diffs sit behind (z=−8) with their output shafts feeding transfers.
  const colX = [-26, -16, -2, 12]; // index 0 ↔ bit 3 … index 3 ↔ bit 0
  const bitOfCol = [3, 2, 1, 0];
  // Mesh-count parity per bit (see header): bits 2 and 0 need reversed dials.
  const reversedBit = [false, true, false, true];

  for (let i = 0; i < 4; i++) {
    const bit = bitOfCol[i];
    const x = colX[i];
    const weight = 2 ** bit;
    diffAlongZ(`D${bit}`, `Σ bit ${bit} (A${bit}+B${bit})`, x, -8);

    for (const [input, zOff, valueBits] of [
      ['A', -4, a],
      ['B', 0, b],
    ] as const) {
      const axleId = `ax_${input}${bit}`;
      axleAt(axleId, `${input}${bit} input shaft`, x, -8 + zOff, 10);
      holdShaft(axleId, `D${bit}`, input === 'A' ? 'inA' : 'inB');
      const value = ((valueBits >> bit) & 1) === 1;
      part({
        id: `dial_${input}${bit}`,
        type: 'inputDial',
        name: `Input ${input} bit ${bit} (adds ${weight})`,
        props: { value, reversed: reversedBit[i], speed: 2.5, torque: 8000 },
        transform: { position: [x, DIAL_Y, -8 + zOff], rotation: ID },
      });
      connect(
        'revolute',
        { partId: `dial_${input}${bit}`, anchorId: 'bore' },
        { partId: axleId, anchorId: 'shaft_9' },
        { keyed: true },
      );
    }

    // Bit-diff output shaft with the 8T transfer pinion up on plane3.
    const outId = `ax_S${bit}`;
    axleAt(outId, `S${bit} = A${bit}+B${bit} shaft`, x, -4, 9);
    holdShaft(outId, `D${bit}`, 'out');
    gearOn(`g_S${bit}`, `S${bit} transfer 8T`, outId, x, -4, PLANE3, 8);
  }

  // --- Horner chain on z = 0 -------------------------------------------------
  // P3' : post-held shaft receiving S3, carrying the first doubling 16T.
  postAt('post_P3', 'Chain post', -26, 0);
  axleAt('ax_P3', 'Chain shaft ×8 stage', -26, 0, 9);
  holdShaft('ax_P3', 'post_P3', 'bearing_top');
  gearOn('g_P3_t', 'S3 receive 8T', 'ax_P3', -26, 0, PLANE3, 8);
  gearOn('g_P3_d', 'Doubling 16T', 'ax_P3', -26, 0, PLANE1, 16);

  // Chain diffs E2, E1, E0 (couplings along X: inA = doubled carry-in,
  // inB = this bit's sum via transfer, out = running total).
  // Alternate the doubling mesh plane (1,2,1) so 16T/8T pairs never collide.
  const chain = [
    { bit: 2, cx: -16, planeIn: PLANE1, planeOut: PLANE2 },
    { bit: 1, cx: -2, planeIn: PLANE2, planeOut: PLANE1 },
    { bit: 0, cx: 12, planeIn: PLANE1, planeOut: PLANE2 },
  ];
  for (const { bit, cx, planeIn, planeOut } of chain) {
    diffAlongX(`E${bit}`, `Σ stage ${bit} (2·carry + S${bit})`, cx, 0);
    // inA: 8T meshing the previous stage's 16T (×2 doubling, distance 6).
    const inAId = `ax_X${bit}`;
    axleAt(inAId, `×2 carry-in shaft (stage ${bit})`, cx - 4, 0, planeIn - BOTTOM + 1);
    holdShaft(inAId, `E${bit}`, 'inA');
    gearOn(`g_X${bit}`, `Doubling pinion 8T`, inAId, cx - 4, 0, planeIn, 8);
    // inB: 8T on plane3 meshing the bit-diff transfer 8T (distance 4).
    const inBId = `ax_T${bit}`;
    axleAt(inBId, `S${bit} receive shaft`, cx, 0, 9);
    holdShaft(inBId, `E${bit}`, 'inB');
    gearOn(`g_T${bit}`, `S${bit} receive 8T`, inBId, cx, 0, PLANE3, 8);
    // out: running total; 16T for the next doubling (8T on the last stage).
    const outId = `ax_P${bit}`;
    const lastStage = bit === 0;
    axleAt(outId, `Running total shaft (≤ stage ${bit})`, cx + 4, 0, planeOut - BOTTOM + 1);
    holdShaft(outId, `E${bit}`, 'out');
    gearOn(
      `g_P${bit}`,
      lastStage ? 'Total output 8T' : 'Doubling 16T',
      outId,
      cx + 4,
      0,
      planeOut,
      lastStage ? 8 : 16,
    );
  }

  // --- 16:1 readout reduction and the drum tower ----------------------------
  // P0 8T (plane2) → W 32T (plane2), then W 8T (plane1) → drum 32T (plane1).
  postAt('post_W', 'Reduction post', 26, 0);
  axleAt('ax_W', 'Reduction shaft 4:1', 26, 0, 8);
  holdShaft('ax_W', 'post_W', 'bearing_top');
  gearOn('g_W_in', 'Reduction wheel 32T', 'ax_W', 26, 0, PLANE2, 32);
  gearOn('g_W_out', 'Reduction pinion 8T', 'ax_W', 26, 0, PLANE1, 8);

  postAt('post_R', 'Readout post', 26, 10);
  axleAt('ax_R', 'Readout shaft (1 unit = 1/32 turn)', 26, 10, 19);
  holdShaft('ax_R', 'post_R', 'bearing_top');
  gearOn('g_R', 'Readout wheel 32T', 'ax_R', 26, 10, PLANE1, 32);

  const drums: Array<{ pattern: string; y: number; radius: number; name: string }> = [
    { pattern: 'decimal', y: 12.1, radius: 6, name: 'Result (decimal)' },
    { pattern: 'bit0', y: 14.1, radius: 5.5, name: 'Result bit 0' },
    { pattern: 'bit1', y: 16.1, radius: 5.5, name: 'Result bit 1' },
    { pattern: 'bit2', y: 18.1, radius: 5.5, name: 'Result bit 2' },
    { pattern: 'bit3', y: 20.1, radius: 5.5, name: 'Result bit 3' },
    { pattern: 'bit4', y: 22.1, radius: 5.5, name: 'Result bit 4 (carry)' },
  ];
  for (const d of drums) {
    part({
      id: `drum_${d.pattern}`,
      type: 'indicatorDrum',
      name: d.name,
      props: { pattern: d.pattern, radius: d.radius, height: 1.8 },
      transform: { position: [26, d.y, 10], rotation: ID },
    });
    connect(
      'revolute',
      { partId: `drum_${d.pattern}`, anchorId: 'bore' },
      { partId: 'ax_R', anchorId: `shaft_${Math.round(d.y - BOTTOM)}` },
      { keyed: true },
    );
  }

  part({
    id: 'pointer',
    type: 'pointerMarker',
    name: 'Read line',
    props: { height: 23 },
    transform: { position: [26, 0.5 + 11.5, 17.8], rotation: ID },
  });
  bolt('pointer');

  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    meta: {
      name: `4-bit adder — ${a} + ${b}`,
      createdAt: now,
      modifiedAt: now,
    },
    settings: { gravity: [0, -981, 0], gridSize: 0.5 },
    parts,
    connections: conns,
  };
}
