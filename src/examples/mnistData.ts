/** Trained model + sample cards for the mechanical MNIST classifier example.
 *
 * Copied verbatim from the quasi-static simulator's `weights/weights.json`
 * on the main branch: a quantized logistic regressor over 7×7 pooled hole
 * counts, weights in {−2,−1,0,1,2}, 87.53% test accuracy, trained by exact
 * coordinate descent on the integer grid. WEIGHTS[k][j] couples pooled block
 * j (row-major 7×7) to digit rod k.
 *
 * Sample cards are MNIST test images binarized at gray level 128, one per
 * digit, hex-packed row-major 28×28 (196 hex chars = 784 bits).
 */

export const WEIGHTS: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 1, 1, 0, -2, 0, 0, 0, 0, 1, 1, -1, 0, 1, 1, -2, -1, 1, 2, 0, 1, 1, -2, 0, 0, 0, 0, 0, 1, 1, -1, 0, 0, 0, 0, 0, 2, -1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, -1, 0, -1, -2, 0, 0, -1, -2, 0, 0, -1, 2, -1, 0, 0, 0, -2, -1, 2, -2, 0, 0, 0, 1, 0, -1, 1, 0, 0, 0, 0, -2, -2, 0, 0, 0],
  [0, 0, 2, 2, 0, 0, 0, 0, 0, 1, 1, 0, -1, -2, 0, 0, -1, -1, 0, 0, -2, 0, -2, -1, 0, -1, -1, -1, 1, 2, 1, 1, 1, 1, 2, 0, 1, 1, 0, 1, 2, 2, 0, 0, -2, -1, 0, 0, 0],
  [0, 0, 1, 2, 0, 0, 0, 0, 2, 2, 1, 0, -2, 0, 2, 0, -2, 0, 1, 0, -1, 0, -2, 0, 1, 0, -1, 0, 2, 0, -2, -2, 1, 1, 0, 0, 2, 1, 0, 1, -1, 0, 0, 2, 2, 1, 0, 0, 0],
  [0, 0, -2, -2, -2, -1, 0, 0, 1, -1, -2, 0, 0, 1, 0, -1, 0, -1, 0, -1, -1, 0, 2, 2, 0, 2, 1, 0, 0, 0, 0, 1, 1, -1, -1, 0, -2, -2, 0, 0, 0, 0, 0, 0, 0, -1, -1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, -1, 2, 0, 1, 0, 2, 0, 0, 1, 1, -1, 1, 2, 0, 0, 1, 0, -1, -2, -2, -1, 1, -1, -1, 0, 0, 0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 1, 2, -1, -1, 0],
  [0, 0, 2, 2, 2, 2, 0, 0, -1, 0, -2, -1, -2, -1, 0, -1, -1, -1, -2, -2, -2, 0, 1, 1, 0, 0, 1, 0, 0, 0, 2, 1, 1, 1, -2, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, -1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 1, -1, 0, 2, 1, 1, 2, 2, 1, -2, 0, 1, -1, -2, 1, 1, 0, 0, -2, -2, 0, 0, -1, 0, 0, -1, -1, -1, -2, -2, 0, 0, 1, 2, 2, 2, 0, 0],
  [0, 0, 0, -2, -1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, -1, 0, 1, 0, 0, 1, 0, -1, 1, 0, -1, -1, -2, 0, 0, 0, 0, 1, 1, -2, 0, -2, 0, 1, 0, 2, 0],
  [0, 0, 0, -1, -1, 0, 0, 0, -2, -1, 1, 1, -1, -2, -1, 0, 1, 1, 1, 0, -1, 0, 2, 1, 0, 2, 0, -2, 0, -1, 0, 0, 0, -2, -2, 0, -2, -2, -2, -2, 0, 0, 0, 1, 2, 1, 2, 2, 0],
];

export const BIAS: ReadonlyArray<number> = [-3, 2, 0, -4, 1, 6, 1, 1, -4, -1];

/** Machine-wide lift: −(worst-case minimum score), so every rod's travel
 * stays above its stop for ANY card. Uniform, so the comparison is unaffected. */
export const LIFT = 401;

export interface SampleCard {
  label: number;
  testIndex: number;
  hex: string;
}

export const SAMPLE_CARDS: ReadonlyArray<SampleCard> = [
  { label: 0, testIndex: 3,
    hex: '000000000000000000000000000000070000007000000f000001f800003fe00007ff00007e70000fc38000f01c000e01c000c01e001c01c001c03c001c0f8001c1f8001cff0000fff0000ffc00007f000001c0000000000000000000000000000000' },
  { label: 1, testIndex: 2,
    hex: '0000000000000000000000000000000040000004000000c000000c000000800000180000018000001800000300000030000003000000600000060000006000000e000000c000000c000001c000001800000180000000000000000000000000000000' },
  { label: 2, testIndex: 1,
    hex: '000000000000000000000000f000007f80000ff80000e1c0000c1800000380000038000007000000f000001e000001c000003c0000038000007800000f000000e000000e003c00ffffc00ffff00007c0000000000000000000000000000000000000' },
  { label: 3, testIndex: 18,
    hex: '000000000000000000000000000000c000003f000007f8000039e000070f000060780006038000623800027fc00007ff00003ffc000003e000000f0006007000700380030038003c0f8001fff00007fc000008000000000000000000000000000000' },
  { label: 4, testIndex: 4,
    hex: '000000000000000000000000000000000000010000001018000300800030080006018000c018000c0380018030001807000180700018060001c3e0000ffe000000e0000006000000e0000006000000e000000c000000800000000000000000000000' },
  { label: 5, testIndex: 8,
    hex: '000000000000000000000000000000000200000ff80007ff80007ff8004780000c000001c0000038000003000000700000070000007e000007ffe0001ffe00001ff00000ef00000ff00000fe000007c0000010000000000000000000000000000000' },
  { label: 6, testIndex: 11,
    hex: '000000000000000000000001c0000038000003000000600000060000006000000e000000c0fc000c1fe000c7c60018f060018e060019c060019c060018c0c0018718001c070000e3e00007fc00001f00000000000000000000000000000000000000' },
  { label: 7, testIndex: 0,
    hex: '000000000000000000000000000000000000000000000000001c000003fff80003ffc0000018000001800000300000070000006000000e000000c000000c000001800000380000070000006000000c000001c000001c000001c00000180000000000' },
  { label: 8, testIndex: 61,
    hex: '0000000000000000000000000000000000000000000007f80001ffe0003c0f00078070007007000300f000383e0001c7c0000ff00000f800007f00003f38000fc38000f9f80007ff00000fc000000000000000000000000000000000000000000000' },
  { label: 9, testIndex: 9,
    hex: '00000000000000000000000000000000000000000000000000001c00000ffc0003ffc000fc5e000f04e001c03e001dffc001fff80007ff000003c0000038000007800000f000001e000001e000003c00000380000078000007000000200000000000' },
];

/** Hex-packed card → 784-character row-major '0'/'1' pattern. */
export function cardBits(hex: string): string {
  let bits = '';
  for (const ch of hex) bits += parseInt(ch, 16).toString(2).padStart(4, '0');
  return bits;
}

/** Pool a 784-bit pattern into 49 row-major 4×4 hole counts. */
export function poolCounts(pattern: string): number[] {
  const counts: number[] = [];
  for (let br = 0; br < 7; br++) {
    for (let bc = 0; bc < 7; bc++) {
      let n = 0;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (pattern[(br * 4 + r) * 28 + bc * 4 + c] === '1') n++;
        }
      }
      counts.push(n);
    }
  }
  return counts;
}

/** Exact integer scores (lifted) — the arithmetic twin the machine must match. */
export function liftedScores(counts: ReadonlyArray<number>): number[] {
  return WEIGHTS.map(
    (row, k) => row.reduce((acc, w, j) => acc + w * counts[j], 0) + BIAS[k] + LIFT,
  );
}
