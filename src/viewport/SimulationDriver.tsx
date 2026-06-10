import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { getEngine, useSimStore } from '@/store/simStore';

/** Fixed-timestep accumulator: physics always steps at 1/120 s regardless of
 * display refresh rate; the speed multiplier scales accumulated time. */
const H = 1 / 120;
const MAX_SUBSTEPS = 4;

export function SimulationDriver() {
  const acc = useRef(0);
  const frame = useRef(0);

  useFrame((_, delta) => {
    const sim = useSimStore.getState();
    const engine = getEngine();
    if (!engine || sim.mode !== 'running') return;

    acc.current += Math.min(delta, 0.1) * sim.speed;
    let steps = 0;
    while (acc.current >= H && steps < MAX_SUBSTEPS) {
      engine.step(H);
      acc.current -= H;
      steps++;
    }
    if (acc.current >= H) acc.current = 0; // can't keep up — drop time, stay real-time
    if (steps > 0) engine.writePoses();

    if (++frame.current % 30 === 0) sim.setStats(engine.stats());
  });

  return null;
}
