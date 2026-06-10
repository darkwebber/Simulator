/** Groups parts into rigid-body "islands": parts joined by fixed connections
 * (or keyed revolutes) become one compound body — far stiffer and cheaper
 * than chains of fixed joints. Pure data transformation; no Rapier here. */

import { qMultiply, qRotate, vAdd, vSub } from '@/model/math';
import type {
  MachineDocument,
  PartInstance,
  Quat,
  Transform,
  Vec3,
} from '@/model/types';
import { getPartDef } from '@/parts/registry';

export interface IslandPart {
  part: PartInstance;
  /** Pose of the part relative to the island body frame. The body frame is
   * (root position, identity rotation), so joint axes built from edit-pose
   * world directions are valid local directions for every body. */
  relPosition: Vec3;
  relRotation: Quat;
}

export interface Island {
  index: number;
  isStatic: boolean;
  /** Body frame origin (world). Body rotation starts as identity. */
  origin: Vec3;
  parts: IslandPart[];
}

export interface AssemblyPlan {
  islands: Island[];
  islandOfPart: Map<string, number>;
}

class UnionFind {
  private parent = new Map<string, string>();

  find(x: string): string {
    let p = this.parent.get(x) ?? x;
    if (p !== x) {
      p = this.find(p);
      this.parent.set(x, p);
    }
    return p;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/**
 * @param excludedPartIds parts that become joints instead of bodies
 *        (fully-connected springs).
 */
export function assembleIslands(
  doc: MachineDocument,
  excludedPartIds: Set<string>,
): AssemblyPlan {
  const parts = doc.parts.filter((p) => !excludedPartIds.has(p.id));
  const uf = new UnionFind();

  for (const c of doc.connections) {
    if (excludedPartIds.has(c.a.partId) || excludedPartIds.has(c.b.partId)) continue;
    const rigid = c.kind === 'fixed' || (c.kind === 'revolute' && c.props.keyed === true);
    if (rigid) uf.union(c.a.partId, c.b.partId);
  }

  const groups = new Map<string, PartInstance[]>();
  for (const part of parts) {
    const root = uf.find(part.id);
    const list = groups.get(root) ?? [];
    list.push(part);
    groups.set(root, list);
  }

  const islands: Island[] = [];
  const islandOfPart = new Map<string, number>();
  for (const group of groups.values()) {
    const index = islands.length;
    const origin = group[0].transform.position;
    const island: Island = {
      index,
      isStatic: group.some((p) => {
        const def = getPartDef(p.type);
        return def.isStatic?.(p.props) ?? false;
      }),
      origin,
      parts: group.map((part) => ({
        part,
        relPosition: vSub(part.transform.position, origin),
        relRotation: part.transform.rotation,
      })),
    };
    islands.push(island);
    for (const p of group) islandOfPart.set(p.id, index);
  }
  return { islands, islandOfPart };
}

/** World pose of a part given its island body's current pose. */
export function partWorldPose(
  bodyPosition: Vec3,
  bodyRotation: Quat,
  ip: IslandPart,
): Transform {
  return {
    position: vAdd(bodyPosition, qRotate(bodyRotation, ip.relPosition)),
    rotation: qMultiply(bodyRotation, ip.relRotation),
  };
}

/** Collider pose relative to the island body frame. */
export function colliderRelPose(
  ip: IslandPart,
  offset: Transform,
): { position: Vec3; rotation: Quat } {
  return {
    position: vAdd(ip.relPosition, qRotate(ip.relRotation, offset.position)),
    rotation: qMultiply(ip.relRotation, offset.rotation),
  };
}
