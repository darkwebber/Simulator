import { useSimStore } from '@/store/simStore';
import { useGearAnalysis } from './useGearAnalysis';
import type { GearInfo } from '@/sim/gearMeshDetector';

function PitchRing({ gear, color }: { gear: GearInfo; color: string }) {
  return (
    <group position={gear.transform.position} quaternion={gear.transform.rotation}>
      {/* Torus axis is local Z; rotate it onto the gear's Y axis. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
        <torusGeometry args={[gear.pitchRadius, 0.05, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

/** Live mechanism feedback while editing: green pitch-circle rings on gears
 * that will couple, orange rings on near-miss pairs that won't. */
export function MeshIndicators() {
  const mode = useSimStore((s) => s.mode);
  const { gears, meshedIds, nearMisses } = useGearAnalysis();

  if (mode !== 'edit') return null;

  const nearMissIds = new Set<string>();
  for (const nm of nearMisses) {
    nearMissIds.add(nm.aPartId);
    nearMissIds.add(nm.bPartId);
  }

  return (
    <>
      {[...meshedIds].map((id) => {
        const gear = gears.get(id);
        return gear ? <PitchRing key={id} gear={gear} color="#39d98a" /> : null;
      })}
      {[...nearMissIds]
        .filter((id) => !meshedIds.has(id))
        .map((id) => {
          const gear = gears.get(id);
          return gear ? <PitchRing key={id} gear={gear} color="#e8a33d" /> : null;
        })}
    </>
  );
}
