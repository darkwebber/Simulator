/** SimulationEngine: builds a Rapier world from a MachineDocument on Run,
 * steps it with the gear/motor coupling solver, and is disposed on Reset.
 * The document is never mutated by the simulation. */

import RAPIER from '@dimforge/rapier3d-compat';
import {
  qConjugate,
  qMultiply,
  qRotate,
  transformDirection,
  transformPoint,
  vAdd,
  vDot,
  vSub,
} from '@/model/math';
import type { MachineDocument, Quat, Vec3 } from '@/model/types';
import { gearDims } from '@/geometry/gearProfile';
import { num } from '@/parts/partDefinition';
import { getPartDef } from '@/parts/registry';
import { motorTargetSpeedRad } from '@/parts/defs/motor';
import {
  assembleIslands,
  colliderRelPose,
  partWorldPose,
  type Island,
} from './bodyAssembler';
import { detectGearMeshes, type GearInfo } from './gearMeshDetector';
import {
  maxGearDrift,
  solveCouplings,
  type BodyView,
  type DifferentialConstraint,
  type GearConstraint,
  type MotorConstraint,
  type ServoConstraint,
} from './gearCouplingSolver';
import { partPoses, poseVersion, springEndpoints } from './syncState';

class RapierBodyView implements BodyView {
  private inv = { m11: 0, m12: 0, m13: 0, m22: 0, m23: 0, m33: 0 };
  private rot: Quat = [0, 0, 0, 1];

  constructor(public readonly body: RAPIER.RigidBody) {}

  refresh(): void {
    const m = this.body.effectiveWorldInvInertia();
    this.inv = { m11: m.m11, m12: m.m12, m13: m.m13, m22: m.m22, m23: m.m23, m33: m.m33 };
    const r = this.body.rotation();
    this.rot = [r.x, r.y, r.z, r.w];
  }

  getAngvel(): Vec3 {
    const v = this.body.angvel();
    return [v.x, v.y, v.z];
  }

  setAngvel(v: Vec3): void {
    this.body.setAngvel({ x: v[0], y: v[1], z: v[2] }, true);
  }

  invInertiaMul(v: Vec3): Vec3 {
    const { m11, m12, m13, m22, m23, m33 } = this.inv;
    return [
      m11 * v[0] + m12 * v[1] + m13 * v[2],
      m12 * v[0] + m22 * v[1] + m23 * v[2],
      m13 * v[0] + m23 * v[1] + m33 * v[2],
    ];
  }

  rotateLocal(v: Vec3): Vec3 {
    return qRotate(this.rot, v);
  }

  getRotation(): Quat {
    return this.rot;
  }
}

/** Rotation vector (axis·angle) of the step from quaternion `prev` to `now`. */
function rotationDelta(prev: Quat, now: Quat): Vec3 {
  // dq = now ⊗ prev⁻¹ (world-frame delta), short way around.
  let dq = qMultiply(now, qConjugate(prev));
  if (dq[3] < 0) dq = [-dq[0], -dq[1], -dq[2], -dq[3]];
  const s = Math.hypot(dq[0], dq[1], dq[2]);
  if (s < 1e-12) return [0, 0, 0];
  const angle = 2 * Math.atan2(s, dq[3]);
  return [(dq[0] / s) * angle, (dq[1] / s) * angle, (dq[2] / s) * angle];
}

interface SpringJointPlan {
  partId: string;
  viewA: RapierBodyView;
  viewB: RapierBodyView;
  localA: Vec3;
  localB: Vec3;
}

export class SimulationEngine {
  readonly warnings: string[] = [];

  private world: RAPIER.World;
  private islands: Island[];
  private views: RapierBodyView[] = [];
  private gears: GearConstraint[] = [];
  private motors: MotorConstraint[] = [];
  private differentials: DifferentialConstraint[] = [];
  private servos: ServoConstraint[] = [];
  private springJoints: SpringJointPlan[] = [];
  private jointCount = 0;
  private disposed = false;

  constructor(doc: MachineDocument) {
    const [gx, gy, gz] = doc.settings.gravity;
    this.world = new RAPIER.World({ x: gx, y: gy, z: gz });

    // --- Springs that connect two bodies become joints, not bodies. ---
    const springPartIds = new Set(
      doc.parts
        .filter((p) => getPartDef(p.type).simTags?.includes('spring'))
        .map((p) => p.id),
    );
    const springEnds = new Map<string, Map<string, { otherPartId: string; world: Vec3 }>>();
    for (const c of doc.connections) {
      for (const [me, other] of [
        [c.a, c.b],
        [c.b, c.a],
      ] as const) {
        if (!springPartIds.has(me.partId) || springPartIds.has(other.partId)) continue;
        const part = doc.parts.find((p) => p.id === me.partId)!;
        const anchor = getPartDef(part.type)
          .getAnchors(part.props)
          .find((a) => a.id === me.anchorId);
        if (!anchor) continue;
        const ends = springEnds.get(me.partId) ?? new Map();
        ends.set(me.anchorId, {
          otherPartId: other.partId,
          world: transformPoint(part.transform, anchor.position),
        });
        springEnds.set(me.partId, ends);
      }
    }
    const jointSpringIds = new Set(
      [...springEnds.entries()].filter(([, ends]) => ends.size >= 2).map(([id]) => id),
    );

    // --- Rigid-body islands. ---
    const plan = assembleIslands(doc, jointSpringIds);
    this.islands = plan.islands;

    for (const island of this.islands) {
      const desc = (island.isStatic
        ? RAPIER.RigidBodyDesc.fixed()
        : RAPIER.RigidBodyDesc.dynamic()
      )
        .setTranslation(...island.origin)
        .setCanSleep(false)
        .setLinearDamping(0.05)
        // Bearing friction: keeps long constraint chains (gear trains,
        // differential adders) critically damped instead of ringing.
        .setAngularDamping(0.4);
      const body = this.world.createRigidBody(desc);

      for (const ip of island.parts) {
        const def = getPartDef(ip.part.type);
        const physical = def.physical(ip.part.props);
        for (const spec of def.buildColliders(ip.part.props)) {
          const rel = colliderRelPose(ip, spec.offset);
          let cd: RAPIER.ColliderDesc;
          if (spec.shape === 'cuboid') {
            cd = RAPIER.ColliderDesc.cuboid(...(spec.halfExtents.map((e) => e) as Vec3));
          } else if (spec.shape === 'cylinder') {
            cd = RAPIER.ColliderDesc.cylinder(spec.halfHeight, spec.radius);
          } else {
            cd = RAPIER.ColliderDesc.ball(spec.radius);
          }
          cd.setTranslation(...rel.position)
            .setRotation({
              x: rel.rotation[0],
              y: rel.rotation[1],
              z: rel.rotation[2],
              w: rel.rotation[3],
            })
            .setDensity(physical.density)
            .setFriction(physical.friction)
            .setRestitution(physical.restitution);
          this.world.createCollider(cd, body);
        }
      }
      this.views.push(new RapierBodyView(body));
    }

    const viewOfPart = (partId: string): RapierBodyView | null => {
      const idx = plan.islandOfPart.get(partId);
      return idx === undefined ? null : this.views[idx];
    };

    // --- Joints from connections (skip pairs merged into one island). ---
    for (const c of doc.connections) {
      if (springPartIds.has(c.a.partId) || springPartIds.has(c.b.partId)) continue;
      const idxA = plan.islandOfPart.get(c.a.partId);
      const idxB = plan.islandOfPart.get(c.b.partId);
      if (idxA === undefined || idxB === undefined || idxA === idxB) continue;
      if (c.kind === 'fixed') continue; // fixed pairs are always same island

      const partA = doc.parts.find((p) => p.id === c.a.partId)!;
      const anchorA = getPartDef(partA.type)
        .getAnchors(partA.props)
        .find((a) => a.id === c.a.anchorId);
      if (!anchorA) continue;
      const worldPoint = transformPoint(partA.transform, anchorA.position);
      const worldAxis = transformDirection(partA.transform, anchorA.axis);
      const bodyA = this.views[idxA].body;
      const bodyB = this.views[idxB].body;
      // Bodies are created with identity rotation, so a world-space direction
      // is a valid local direction for both, and local anchors are simple
      // world offsets from each body origin.
      const a1 = vSub(worldPoint, this.islands[idxA].origin);
      const a2 = vSub(worldPoint, this.islands[idxB].origin);
      const vec = (v: Vec3) => ({ x: v[0], y: v[1], z: v[2] });

      let data: RAPIER.JointData;
      if (c.kind === 'revolute') {
        data = RAPIER.JointData.revolute(vec(a1), vec(a2), vec(worldAxis));
      } else if (c.kind === 'prismatic') {
        data = RAPIER.JointData.prismatic(vec(a1), vec(a2), vec(worldAxis));
      } else {
        continue;
      }
      const joint = this.world.createImpulseJoint(data, bodyA, bodyB, true);
      joint.setContactsEnabled(false);
      this.jointCount++;

      if (c.kind === 'revolute' && c.props.motor === true) {
        const motorPart = [partA, doc.parts.find((p) => p.id === c.b.partId)!].find(
          (p) => getPartDef(p.type).simTags?.includes('motor'),
        );
        if (motorPart) {
          const motorView = viewOfPart(motorPart.id)!;
          const otherView = motorView === this.views[idxA] ? this.views[idxB] : this.views[idxA];
          // Drive the shaft relative to the housing about the coupling axis.
          this.motors.push({
            a: motorView,
            b: otherView,
            localAxisA: worldAxis,
            localAxisB: worldAxis,
            targetVel: motorTargetSpeedRad(motorPart.props),
            maxTorque: num(motorPart.props, 'maxTorque', 20000),
          });
        }
      }
    }

    // --- Spring joints. ---
    for (const springId of jointSpringIds) {
      const ends = [...springEnds.get(springId)!.values()];
      const viewA = viewOfPart(ends[0].otherPartId);
      const viewB = viewOfPart(ends[1].otherPartId);
      const springPart = doc.parts.find((p) => p.id === springId)!;
      if (!viewA || !viewB) continue;
      if (viewA === viewB) {
        this.warnings.push(
          `Spring ${springPart.name ?? springId} connects a body to itself and has no effect.`,
        );
        continue;
      }
      const localA = vSub(ends[0].world, [
        viewA.body.translation().x,
        viewA.body.translation().y,
        viewA.body.translation().z,
      ]);
      const localB = vSub(ends[1].world, [
        viewB.body.translation().x,
        viewB.body.translation().y,
        viewB.body.translation().z,
      ]);
      const data = RAPIER.JointData.spring(
        num(springPart.props, 'restLength', 6),
        num(springPart.props, 'stiffness', 300),
        num(springPart.props, 'damping', 8),
        { x: localA[0], y: localA[1], z: localA[2] },
        { x: localB[0], y: localB[1], z: localB[2] },
      );
      this.world.createImpulseJoint(data, viewA.body, viewB.body, true);
      this.jointCount++;
      this.springJoints.push({ partId: springId, viewA, viewB, localA, localB });
    }

    // --- Gear couplings, inferred from geometry. ---
    const gearInfos: GearInfo[] = [];
    for (const part of doc.parts) {
      const def = getPartDef(part.type);
      if (!def.simTags?.includes('gear')) continue;
      const islandIndex = plan.islandOfPart.get(part.id);
      if (islandIndex === undefined) continue;
      const teeth = Math.round(num(part.props, 'teeth', 16));
      const module = num(part.props, 'module', 0.5);
      gearInfos.push({
        partId: part.id,
        islandIndex,
        transform: part.transform,
        teeth,
        module,
        faceWidth: num(part.props, 'width', 1),
        pitchRadius: gearDims(teeth, module).rPitch,
      });
    }
    const detection = detectGearMeshes(gearInfos);
    this.warnings.push(...detection.warnings);
    for (const mesh of detection.meshes) {
      this.gears.push({
        a: this.views[mesh.islandA],
        b: this.views[mesh.islandB],
        localAxisA: mesh.worldAxisA,
        localAxisB: mesh.worldAxisB,
        teethA: mesh.teethA,
        teethB: mesh.teethB,
        C: 0,
      });
    }

    // --- Differentials: θ_out = θ_inA + θ_inB about the housing axis. ---
    for (const part of doc.parts) {
      const def = getPartDef(part.type);
      if (!def.simTags?.includes('differential')) continue;
      const housing = viewOfPart(part.id);
      if (!housing) continue;
      const axis = transformDirection(part.transform, [0, 1, 0]);
      const shaft = (anchorId: string): RapierBodyView | null => {
        for (const c of doc.connections) {
          for (const [me, other] of [
            [c.a, c.b],
            [c.b, c.a],
          ] as const) {
            if (me.partId === part.id && me.anchorId === anchorId) {
              return viewOfPart(other.partId);
            }
          }
        }
        return null;
      };
      const inA = shaft('inA');
      const inB = shaft('inB');
      const out = shaft('out');
      if (!inA || !inB || !out) {
        this.warnings.push(
          `Differential ${part.name ?? part.id} has unconnected couplings and is inactive.`,
        );
        continue;
      }
      this.differentials.push({
        housing,
        inA,
        inB,
        out,
        localAxisH: axis,
        localAxisA: axis,
        localAxisB: axis,
        localAxisO: axis,
        C: 0,
      });
    }

    // --- Servos (input dials): drive the dial's island to a set angle. ---
    for (const part of doc.parts) {
      const def = getPartDef(part.type);
      if (!def.simTags?.includes('servo')) continue;
      const view = viewOfPart(part.id);
      if (!view) continue;
      const reversed = part.props.reversed === true;
      const value = part.props.value === true;
      this.servos.push({
        body: view,
        localAxis: transformDirection(part.transform, [0, 1, 0]),
        targetAngle: (reversed ? -1 : 1) * (value ? Math.PI : 0),
        kp: 6,
        maxVel: num(part.props, 'speed', 5),
        maxTorque: num(part.props, 'torque', 50000),
        theta: 0,
      });
    }
  }

  private prevRots: Quat[] = [];

  step(h: number): void {
    if (this.disposed) return;
    this.world.timestep = h;
    this.world.step();
    const n =
      this.gears.length +
      this.motors.length +
      this.differentials.length +
      this.servos.length;
    if (n === 0) return;

    for (const view of this.views) view.refresh();

    // Position-level bookkeeping from the bodies' TRUE rotation deltas (see
    // solver header): gear/diff phase error C and servo angles.
    if (this.prevRots.length === 0) {
      this.prevRots = this.views.map((v) => v.getRotation());
    }
    const deltas = new Map<BodyView, Vec3>();
    this.views.forEach((view, i) => {
      deltas.set(view, rotationDelta(this.prevRots[i], view.getRotation()));
      this.prevRots[i] = view.getRotation();
    });
    const dAbout = (view: BodyView, localAxis: Vec3): number =>
      vDot(deltas.get(view) ?? [0, 0, 0], view.rotateLocal(localAxis));

    for (const g of this.gears) {
      g.C += g.teethA * dAbout(g.a, g.localAxisA) + g.teethB * dAbout(g.b, g.localAxisB);
    }
    for (const d of this.differentials) {
      d.C +=
        dAbout(d.out, d.localAxisO) -
        dAbout(d.inA, d.localAxisA) -
        dAbout(d.inB, d.localAxisB) +
        dAbout(d.housing, d.localAxisA) +
        dAbout(d.housing, d.localAxisB) -
        dAbout(d.housing, d.localAxisO);
    }
    for (const s of this.servos) {
      s.theta += dAbout(s.body, s.localAxis);
    }

    // Long differential/gear chains benefit from extra Gauss-Seidel sweeps.
    const deep = this.differentials.length > 0;
    solveCouplings(
      {
        gears: this.gears,
        motors: this.motors,
        differentials: this.differentials,
        servos: this.servos,
      },
      h,
      deep ? 256 : 8,
    );
  }

  /** Snapshot all part poses into the renderer-facing sync maps. */
  writePoses(): void {
    if (this.disposed) return;
    for (let i = 0; i < this.islands.length; i++) {
      const body = this.views[i].body;
      const t = body.translation();
      const r = body.rotation();
      const bodyPos: Vec3 = [t.x, t.y, t.z];
      const bodyRot: Quat = [r.x, r.y, r.z, r.w];
      for (const ip of this.islands[i].parts) {
        const pose = partWorldPose(bodyPos, bodyRot, ip);
        partPoses.set(ip.part.id, { position: pose.position, quaternion: pose.rotation });
      }
    }
    for (const s of this.springJoints) {
      const ta = s.viewA.body.translation();
      const ra = s.viewA.body.rotation();
      const tb = s.viewB.body.translation();
      const rb = s.viewB.body.rotation();
      springEndpoints.set(s.partId, {
        a: vAdd([ta.x, ta.y, ta.z], qRotate([ra.x, ra.y, ra.z, ra.w], s.localA)),
        b: vAdd([tb.x, tb.y, tb.z], qRotate([rb.x, rb.y, rb.z, rb.w], s.localB)),
      });
    }
    poseVersion.n++;
  }

  stats() {
    return {
      bodies: this.islands.filter((i) => !i.isStatic).length,
      joints: this.jointCount,
      couplings: this.gears.length + this.differentials.length,
      motors: this.motors.length + this.servos.length,
      maxGearDrift: Math.max(
        maxGearDrift(this.gears),
        this.differentials.reduce((m, d) => Math.max(m, Math.abs(d.C)), 0),
      ),
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.world.free();
  }
}
