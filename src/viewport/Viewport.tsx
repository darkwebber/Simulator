import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, Grid, OrbitControls } from '@react-three/drei';
import { useEditorStore } from '@/store/editorStore';
import { useSimStore } from '@/store/simStore';
import { commitGhost, updateGhostFromPoint } from '@/editor/placement';
import { SceneParts } from './SceneParts';
import { GhostPart } from './GhostPart';
import { AnchorMarkers } from './AnchorMarkers';
import { MeshIndicators } from './MeshIndicators';
import { SelectionGizmo } from './SelectionGizmo';
import { SimulationDriver } from './SimulationDriver';

/** Invisible plane that drives ghost placement and click-to-commit. */
function PlacementPlane() {
  const placing = useEditorStore((s) => s.placing !== null);
  if (!placing) return null;
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      visible={false}
      onPointerMove={(e: ThreeEvent<PointerEvent>) =>
        updateGhostFromPoint([e.point.x, e.point.y, e.point.z])
      }
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        commitGhost();
      }}
    >
      <planeGeometry args={[1000, 1000]} />
    </mesh>
  );
}

export function Viewport() {
  const mode = useSimStore((s) => s.mode);

  return (
    <div className="viewport">
      <Canvas
        shadows
        camera={{ position: [28, 22, 28], fov: 40, near: 0.5, far: 2000 }}
        onPointerMissed={() => {
          const editor = useEditorStore.getState();
          if (editor.placing) editor.cancelPlacing();
          else editor.select(null);
        }}
      >
        <color attach="background" args={['#16191d']} />
        <hemisphereLight args={['#dfe6ee', '#3a414b', 1.1]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[-25, 30, -30]} intensity={0.7} />
        <directionalLight
          position={[30, 50, 20]}
          intensity={2.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />
        <Grid
          position={[0, -0.01, 0]}
          args={[200, 200]}
          cellSize={1}
          cellColor="#2e343c"
          sectionSize={10}
          sectionColor="#3d4654"
          fadeDistance={140}
          infiniteGrid
        />
        <ContactShadows
          position={[0, -0.005, 0]}
          opacity={0.5}
          scale={120}
          blur={2.2}
          far={30}
          resolution={512}
          frames={mode === 'edit' ? 1 : Infinity}
        />
        <SceneParts />
        <GhostPart />
        <AnchorMarkers />
        <MeshIndicators />
        <SelectionGizmo />
        <SimulationDriver />
        <PlacementPlane />
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.02} />
      </Canvas>
    </div>
  );
}
