import { useMemo } from 'react';
import { useDocumentStore } from '@/store/documentStore';
import { useSimStore } from '@/store/simStore';
import { assembleIslands } from '@/sim/bodyAssembler';
import { detectGearMeshes, type GearInfo } from '@/sim/gearMeshDetector';
import { gearDims } from '@/geometry/gearProfile';
import { getPartDef } from '@/parts/registry';
import { num } from '@/parts/partDefinition';

/** Green pitch-circle rings on gears that will couple when the simulation
 * runs — instant feedback that two gears really mesh. */
export function MeshIndicators() {
  const doc = useDocumentStore((s) => s.doc);
  const mode = useSimStore((s) => s.mode);

  const rings = useMemo(() => {
    const gears: GearInfo[] = [];
    const plan = assembleIslands(doc, new Set());
    for (const part of doc.parts) {
      if (!getPartDef(part.type).simTags?.includes('gear')) continue;
      const teeth = Math.round(num(part.props, 'teeth', 16));
      const module = num(part.props, 'module', 0.5);
      gears.push({
        partId: part.id,
        islandIndex: plan.islandOfPart.get(part.id) ?? -1,
        transform: part.transform,
        teeth,
        module,
        faceWidth: num(part.props, 'width', 1),
        pitchRadius: gearDims(teeth, module).rPitch,
      });
    }
    const { meshes } = detectGearMeshes(gears);
    const byId = new Map(gears.map((g) => [g.partId, g]));
    const out: Array<{ key: string; gear: GearInfo }> = [];
    const seen = new Set<string>();
    for (const m of meshes) {
      for (const id of [m.aPartId, m.bPartId]) {
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({ key: id, gear: byId.get(id)! });
      }
    }
    return out;
  }, [doc]);

  if (mode !== 'edit') return null;

  return (
    <>
      {rings.map(({ key, gear }) => (
        <group
          key={key}
          position={gear.transform.position}
          quaternion={gear.transform.rotation}
        >
          {/* Torus axis is local Z; rotate it onto the gear's Y axis. */}
          <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
            <torusGeometry args={[gear.pitchRadius, 0.05, 8, 64]} />
            <meshBasicMaterial color="#39d98a" transparent opacity={0.8} />
          </mesh>
        </group>
      ))}
    </>
  );
}
