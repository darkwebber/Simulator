import { useMemo } from 'react';
import { useDocumentStore } from '@/store/documentStore';
import { assembleIslands } from '@/sim/bodyAssembler';
import { detectGearMeshes, type GearInfo, type NearMiss } from '@/sim/gearMeshDetector';
import { computeGearPhases } from '@/sim/gearPhase';
import { gearDims } from '@/geometry/gearProfile';
import { getPartDef } from '@/parts/registry';
import { num } from '@/parts/partDefinition';
import type { MachineDocument } from '@/model/types';

export interface GearAnalysis {
  gears: Map<string, GearInfo>;
  /** Gear partIds that will couple when the simulation runs. */
  meshedIds: Set<string>;
  /** Render-time tooth-phase rotation (rad about local +Y) per meshed gear. */
  phases: Map<string, number>;
  nearMisses: NearMiss[];
}

function analyze(doc: MachineDocument): GearAnalysis {
  const infos: GearInfo[] = [];
  const plan = assembleIslands(doc, new Set());
  for (const part of doc.parts) {
    if (!getPartDef(part.type).simTags?.includes('gear')) continue;
    const teeth = Math.round(num(part.props, 'teeth', 16));
    const module = num(part.props, 'module', 0.5);
    infos.push({
      partId: part.id,
      islandIndex: plan.islandOfPart.get(part.id) ?? -1,
      transform: part.transform,
      teeth,
      module,
      faceWidth: num(part.props, 'width', 1),
      pitchRadius: gearDims(teeth, module).rPitch,
    });
  }
  const { meshes, nearMisses } = detectGearMeshes(infos);
  const meshedIds = new Set<string>();
  for (const m of meshes) {
    meshedIds.add(m.aPartId);
    meshedIds.add(m.bPartId);
  }
  const phases = computeGearPhases(infos, meshes);
  return { gears: new Map(infos.map((g) => [g.partId, g])), meshedIds, phases, nearMisses };
}

/** Live edit-mode gear-mesh analysis, recomputed when the document changes. */
export function useGearAnalysis(): GearAnalysis {
  const doc = useDocumentStore((s) => s.doc);
  return useMemo(() => analyze(doc), [doc]);
}
