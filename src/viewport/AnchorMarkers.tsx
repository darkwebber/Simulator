import { useMemo } from 'react';
import { useDocumentStore } from '@/store/documentStore';
import { useEditorStore } from '@/store/editorStore';
import { compatibleTargets } from '@/editor/snapping';

/** Small glowing dots on every anchor the part being placed could snap to;
 * the active snap target glows brighter and larger. */
export function AnchorMarkers() {
  const doc = useDocumentStore((s) => s.doc);
  const placing = useEditorStore((s) => s.placing);

  const targets = useMemo(() => {
    if (!placing) return [];
    return compatibleTargets(doc, placing.type, placing.props, null);
  }, [doc, placing?.type, placing?.props]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!placing) return null;
  const active = placing.snap?.target;

  return (
    <>
      {targets.map((t) => {
        const isActive =
          active && active.partId === t.partId && active.anchor.id === t.anchor.id;
        return (
          <mesh
            key={`${t.partId}:${t.anchor.id}`}
            position={t.worldPos}
            raycast={() => null}
          >
            <sphereGeometry args={[isActive ? 0.32 : 0.16, 12, 12]} />
            <meshBasicMaterial
              color={isActive ? '#39d98a' : '#4da3ff'}
              transparent
              opacity={isActive ? 0.95 : 0.6}
            />
          </mesh>
        );
      })}
    </>
  );
}
