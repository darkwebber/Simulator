import { useMemo } from 'react';
import * as THREE from 'three';
import { useEditorStore } from '@/store/editorStore';
import { getGeometry } from '@/geometry/geometryCache';
import { getPartDef } from '@/parts/registry';

/** Translucent preview of the part being placed; green when snapped. */
export function GhostPart() {
  const placing = useEditorStore((s) => s.placing);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    [],
  );

  if (!placing?.transform) return null;
  const geometry = getGeometry(placing.type, placing.props);
  const visual = getPartDef(placing.type).visual(placing.props);
  material.color.set(placing.snap ? '#39d98a' : visual.color);
  material.emissive.set(placing.snap ? '#0f5132' : '#222222');

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={placing.transform.position}
      quaternion={placing.transform.rotation}
      raycast={() => null}
    />
  );
}
