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

Three machines ship with the app (toolbar buttons):

- **Gears demo** — a motor driving a 3:1 gear reduction.
- **4-bit adder** — a complete mechanical adder. Select any input dial,
  toggle its *Value* in the Inspector (A and B are 4 bits each), press
  **Run**, and read A+B off the drum tower — in binary and decimal.
- **MNIST classifier** — the punched-card digit classifier from the
  quasi-static simulator on `main`, assembled as a real machine. Press
  **Run**: 49 feeler columns read the card, 245 weighted cords lace the
  scores into ten sliding rods, and a falling bar settles on the tallest —
  the rod it lands on names the digit.

## The mechanical 4-bit adder

The adder computes the way mechanical analog computers did:

1. Each input bit is an **input dial** — a servo turns it half a revolution
   for a 1 (green when set, red when clear).
2. A **differential gearbox** (Σ) per bit column adds the two dials:
   S_k = A_k + B_k as shaft rotation.
3. A Horner chain of differentials and 2:1 gear doublings accumulates
   V = ((2·S₃ + S₂)·2 + S₁)·2 + S₀ = Σ(A_k+B_k)·2^k on one shaft —
   carries are literally rotations cascading through the gear train.
4. A 16:1 reduction scales the result to 1/32 turn per unit, and a tower of
   32-sector **indicator drums** — binary encoder drums, one per output bit
   plus a decimal drum — displays the sum under a fixed pointer.

Every shaft is a real rigid body: you can inspect any part, retune a dial,
or pull a gear out of mesh and watch the sum lose that bit. The headless
integration test (`src/examples/fourBitAdder.test.ts`) builds this exact
machine in a real physics world and verifies ten different additions land
within 0.15 of a drum sector.

## The mechanical MNIST classifier

The trained model from `main` (quantized logistic regressor, weights in
{−2…+2}, 87.53% test accuracy) realized in parts:

1. A **punched card** sits in its press frame; a **feeler column** over each
   4×4 block turns its capstan in proportion to the block's hole count
   (pooling by stacking, condensed into one part per block).
2. Every nonzero trained weight is a **weighted cord** from a feeler capstan
   to a digit's **score rod**: |w| = 1 is a straight lacing, |w| = 2 runs
   round a 2:1 pulley, the sign is the side it pulls — and a zero weight is
   a part that doesn't exist (245 of 490 cords are built).
3. Each score rod slides in a guide; its height *is* the digit's score
   (bias = rest cord length, set at assembly; a machine-wide lift keeps every
   rod above its stop for any card). The lacing is solved as one n-ary
   cord-loom coupling per rod — the differential's constraint generalized to
   weighted sums, with a linear DOF on the rod.
4. A **falling bar** slides straight down over the rods and settles on the
   tallest: argmax by gravity. The rod it rests on names the digit.

`src/examples/mnistClassifier.test.ts` runs sample cards through the real
physics world and checks every rod against exact integer arithmetic — any
disagreement is an assembly bug, not noise.

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
  contacts, joints, springs), except mechanical transmission, which is a set
  of mathematical constraints solved by a custom sequential-impulse solver
  with anti-drift feedback: gear meshes (tooth-ratio coupling), summing
  differentials (θ_out = θ_A + θ_B), torque-limited motors and position
  servos. Symmetric (any gear can drive any other, differentials back-drive)
  and honest about torque (motors and servos stall at their limit). Drift
  correction is grounded in the bodies' actual rotations, so long runs and
  deep chains stay phase-locked.
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
