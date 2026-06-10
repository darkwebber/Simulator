# Mechanical Simulator

A web-based 3D sandbox for building and testing real mechanical assemblies —
gears, axles, springs, motors, levers — the way you would on a workbench:
snap parts together like LEGO, tune their physical properties, press **Run**
and watch the machine come to life under gravity and rigid-body physics.

The long-term goal is rapid prototyping of mechanical analog computers and
mechanical digital logic; this version is the core sandbox that everything
else (punch cards, drum boxes, sequencers, worm gears…) plugs into.

## Quick start

```bash
npm install
npm run dev        # open the printed URL
npm test           # unit tests (gear math, solver, snapping, serialization)
npm run build      # static production build in dist/
```

Click **Demo** in the toolbar to load the bundled 3:1 gear-reduction machine,
then press **Run** (or Space).

## How to build a machine

1. **Place a Baseplate** — the fixed work surface with a grid of mounting holes.
2. Click a part in the palette and aim into the scene; a translucent ghost
   follows the pointer. Compatible attachment points glow blue, and the ghost
   turns **green** when it snaps. Click to place; Esc ends placement.
3. **Posts** peg into baseplate holes. **Axles** stand in post top-bearings or
   in a **Motor** coupling; they also ride horizontally in post side-bearings.
4. **Gears and discs** slide onto axles. *Keyed* parts rotate with the shaft;
   un-keyed ones spin freely (toggle per connection in the Inspector).
5. Two gears with the **same module** mesh automatically when their pitch
   circles touch — green rings show every detected mesh. Tooth ratio,
   counter-rotation, stall and back-driving all behave physically.
6. Select a part to edit its properties (teeth, module, mass-relevant size,
   motor speed/torque, spring stiffness…), move it (T) or rotate it (R).
7. **Run / Pause / Reset** in the toolbar; the speed slider scales time.
   Reset returns to the exact edit pose — the simulation never modifies your
   design.

Machines autosave to the browser and can be exported/imported as JSON files.

## Keyboard

| Key | Action |
| --- | --- |
| Space | Run / pause / resume |
| Esc | Cancel placement / deselect |
| Del | Delete selected part |
| T / R | Translate / rotate gizmo |
| Ctrl+Z / Ctrl+Shift+Z | Undo / redo |

## Architecture

```
src/
├─ model/      Pure data: MachineDocument (parts + connections), math, save files
├─ parts/      Part type registry — each part is one PartDefinition (anchors,
│              parametric geometry, colliders, props schema, sim tags)
├─ geometry/   Procedural meshes (involute gear profiles, primitives) + cache
├─ editor/     Snapping (connections derived from anchor geometry), commands
├─ sim/        Physics: body islands → Rapier world, geometric gear-mesh
│              detection, sequential-impulse gear/motor coupling solver
├─ store/      zustand stores (document + zundo undo, editor, simulation)
├─ viewport/   react-three-fiber scene, gizmo, ghost placement, sim driver
└─ ui/         Toolbar, palette, schema-driven inspector, persistence
```

Key design decisions:

- **The document is the single source of truth.** The Rapier world is built
  from it on Run and disposed on Reset; the simulation never mutates it.
- **Hybrid physics.** Everything is real rigid-body simulation (gravity,
  contacts, joints, springs), except gear meshing, which is a mathematical
  ratio constraint solved by a custom sequential-impulse solver with
  anti-drift feedback — stable for long gear trains, yet symmetric (any gear
  can drive any other) and honest about torque (motors stall at their limit).
- **Meshing is inferred from geometry**, never stored: position two
  same-module gears rim-to-rim and they couple, move them apart and they
  don't — like real hardware.
- **Fixed attachments compound into one rigid body** (union-find islands),
  eliminating joint jitter for keyed gears and bolted frames.
- **Connections are derived from anchor coincidence**, so dragging an axle
  through two posts picks up both bearings automatically.
- Units: 1 world unit = 1 cm, gravity 981 cm/s².

Adding a new part type (e.g. a punch-card reader) is one new file in
`src/parts/defs/` implementing `PartDefinition` — the palette, inspector,
serialization, snapping and physics assembly pick it up automatically.

## License

Apache-2.0
