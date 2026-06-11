/** End-to-end test of the mechanical MNIST classifier: build the machine in a
 * real Rapier world, let the feelers read the card and the bar fall, then
 * check every score rod against exact integer arithmetic — any disagreement
 * is an assembly bug, not noise — and that the bar names the right digit. */

import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import '@/parts';
import { SimulationEngine } from '@/sim/engine';
import { partPoses } from '@/sim/syncState';
import { mnistClassifierDemo, rodTopForScore } from './mnistClassifier';
import { SAMPLE_CARDS, cardBits, liftedScores, poolCounts } from './mnistData';

const H = 1 / 120;
const ROD_LEN = 12;
const BAR_THICKNESS = 1.2;
/** The bar lands on each rod's contact cap, 0.35 cm above the shaft top. */
const CAP = 0.35;

function runMachine(sampleIndex: number) {
  const engine = new SimulationEngine(mnistClassifierDemo(sampleIndex));
  expect(engine.warnings).toEqual([]);
  for (let i = 0; i < 600; i++) engine.step(H); // 5 simulated seconds
  engine.writePoses();
  const rodTops = Array.from({ length: 10 }, (_, k) => {
    const pose = partPoses.get(`rod_${k}`)!;
    return pose.position[1] + ROD_LEN / 2;
  });
  const barBottom = partPoses.get('bar')!.position[1] - BAR_THICKNESS / 2;
  engine.dispose();
  return { rodTops, barBottom };
}

describe('mechanical MNIST classifier', () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it('builds with the expected mechanism inventory', { timeout: 60000 }, () => {
    const engine = new SimulationEngine(mnistClassifierDemo());
    expect(engine.warnings).toEqual([]);
    const stats = engine.stats();
    // One cord-loom coupling per score rod; one servo per feeler column.
    expect(stats.couplings).toBe(10);
    expect(stats.motors).toBe(49);
    engine.dispose();
  });

  // One sample card per digit is checked in; classify a spread of them.
  it.each([0, 3, 7, 9])(
    'classifies sample card %i against exact integer arithmetic',
    { timeout: 120000 },
    (sampleIndex) => {
      const sample = SAMPLE_CARDS[sampleIndex];
      const expected = liftedScores(poolCounts(cardBits(sample.hex)));
      const winner = expected.indexOf(Math.max(...expected));
      expect(winner).toBe(sample.label); // the model gets these cards right

      const { rodTops, barBottom } = runMachine(sampleIndex);

      // Every rod's height is its score, within 5 score units (0.15 cm).
      for (let k = 0; k < 10; k++) {
        expect(Math.abs(rodTops[k] - rodTopForScore(expected[k]))).toBeLessThan(0.15);
      }

      // The bar rests on the winning rod's cap...
      expect(Math.abs(barBottom - (rodTops[winner] + CAP))).toBeLessThan(0.15);
      // ...and clear of every other rod (the margins are real score gaps).
      for (let k = 0; k < 10; k++) {
        if (k === winner) continue;
        expect(barBottom).toBeGreaterThan(rodTops[k] + CAP - 0.05);
      }
    },
  );
});
