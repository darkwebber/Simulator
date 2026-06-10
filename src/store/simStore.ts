import { create } from 'zustand';
import { SimulationEngine } from '@/sim/engine';
import { clearPoses } from '@/sim/syncState';
import { useDocumentStore } from './documentStore';
import { useEditorStore } from './editorStore';

export type SimMode = 'edit' | 'running' | 'paused';

export interface SimStats {
  bodies: number;
  joints: number;
  couplings: number;
  motors: number;
  maxGearDrift: number;
}

interface SimState {
  mode: SimMode;
  /** Simulation speed multiplier (0.1 .. 4). */
  speed: number;
  showDebug: boolean;
  warnings: string[];
  stats: SimStats | null;
  run: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
  toggleDebug: () => void;
  setStats: (stats: SimStats) => void;
}

/** The live physics engine — deliberately outside zustand state (it is
 * mutable, non-serializable, and stepped 120×/s). */
let engine: SimulationEngine | null = null;

export function getEngine(): SimulationEngine | null {
  return engine;
}

export const useSimStore = create<SimState>()((set, get) => ({
  mode: 'edit',
  speed: 1,
  showDebug: false,
  warnings: [],
  stats: null,
  run: () => {
    if (get().mode !== 'edit') return;
    useEditorStore.getState().select(null);
    useEditorStore.getState().cancelPlacing();
    const doc = useDocumentStore.getState().doc;
    engine = new SimulationEngine(doc);
    set({ mode: 'running', warnings: engine.warnings, stats: engine.stats() });
  },
  pause: () => {
    if (get().mode === 'running') set({ mode: 'paused' });
  },
  resume: () => {
    if (get().mode === 'paused') set({ mode: 'running' });
  },
  reset: () => {
    engine?.dispose();
    engine = null;
    clearPoses();
    set({ mode: 'edit', warnings: [], stats: null });
  },
  setSpeed: (speed) => set({ speed }),
  toggleDebug: () => set((s) => ({ showDebug: !s.showDebug })),
  setStats: (stats) => set({ stats }),
}));
