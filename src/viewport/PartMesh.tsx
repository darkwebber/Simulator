import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import type { PartInstance } from '@/model/types';
import { getAccentGeometry, getGeometry } from '@/geometry/geometryCache';
import { getPartDef } from '@/parts/registry';
import { useEditorStore } from '@/store/editorStore';
import { useSimStore } from '@/store/simStore';
import { updateGhostFromPoint } from '@/editor/placement';
import { registerMesh, unregisterMesh } from './meshRegistry';

export function PartMesh({ part }: { part: PartInstance }) {
  const groupRef = useRef<THREE.Group>(null);
  const def = getPartDef(part.type);
  const geometry = getGeometry(part.type, part.props);
  const accentGeometry = getAccentGeometry(part.type, part.props);
  const visual = def.visual(part.props);
  const accentColor = def.accentColor?.(part.props) ?? '#20262c';
  const selected = useEditorStore((s) => s.selectedPartId === part.id);
  const placing = useEditorStore((s) => s.placing !== null);
  const editMode = useSimStore((s) => s.mode === 'edit');
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && editMode && !placing);

  const sideTexture = def.buildSideTexture?.(part.props) ?? null;

  const material = useMemo(() => {
    const base = new THREE.MeshStandardMaterial({
      color: visual.color,
      metalness: visual.metalness,
      roughness: visual.roughness,
    });
    if (!sideTexture) return base;
    // Cylinder geometry groups: [side, top cap, bottom cap].
    const side = new THREE.MeshStandardMaterial({
      map: sideTexture,
      metalness: 0.2,
      roughness: 0.6,
    });
    return [side, base, base];
  }, [visual.color, visual.metalness, visual.roughness, sideTexture]);

  const accentMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: accentColor,
        metalness: Math.min(visual.metalness + 0.1, 1),
        roughness: Math.max(visual.roughness - 0.1, 0),
      }),
    [accentColor, visual.metalness, visual.roughness],
  );

  useEffect(
    () => () => {
      (Array.isArray(material) ? material : [material]).forEach((m) => m.dispose());
      accentMaterial.dispose();
    },
    [material, accentMaterial],
  );

  useEffect(() => {
    const emissive = selected ? '#2a6fc9' : hovered && editMode && !placing ? '#3b4a5c' : '#000000';
    const intensity = selected ? 0.4 : hovered ? 0.5 : 0;
    for (const m of [...(Array.isArray(material) ? material : [material]), accentMaterial]) {
      m.emissive.set(emissive);
      m.emissiveIntensity = intensity;
    }
  }, [selected, hovered, editMode, placing, material, accentMaterial]);

  useEffect(() => {
    const obj = groupRef.current;
    if (!obj) return;
    registerMesh(part.id, obj);
    return () => unregisterMesh(part.id);
  }, [part.id]);

  // Initial pose; per-frame updates come from SceneParts (doc or physics).
  useEffect(() => {
    const obj = groupRef.current;
    if (!obj) return;
    obj.position.set(...part.transform.position);
    obj.quaternion.set(...part.transform.rotation);
  }, [part.transform]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (placing) return; // placement plane (or this part's hover) owns the click
    e.stopPropagation();
    if (useSimStore.getState().mode === 'edit') {
      useEditorStore.getState().select(part.id);
    }
  };

  // While placing, hovering an existing part aims the ghost at its surface so
  // elevated anchors (axles in bearings, motor couplings…) are snappable.
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!placing) return;
    e.stopPropagation();
    updateGhostFromPoint([e.point.x, e.point.y, e.point.z]);
  };

  return (
    <group ref={groupRef}>
      <mesh
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
        onClick={onClick}
        onPointerMove={onPointerMove}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        {accentGeometry && (
          <mesh geometry={accentGeometry} material={accentMaterial} castShadow receiveShadow />
        )}
      </mesh>
    </group>
  );
}
