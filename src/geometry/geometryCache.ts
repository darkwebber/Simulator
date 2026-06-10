import type * as THREE from 'three';
import type { PartProps } from '@/parts/partDefinition';
import { getPartDef } from '@/parts/registry';

const cache = new Map<string, THREE.BufferGeometry>();

export function cacheKey(type: string, props: PartProps): string {
  return `${type}:${JSON.stringify(props)}`;
}

export function getGeometry(type: string, props: PartProps): THREE.BufferGeometry {
  const key = cacheKey(type, props);
  let geo = cache.get(key);
  if (!geo) {
    geo = getPartDef(type).buildGeometry(props);
    cache.set(key, geo);
    evictIfNeeded();
  }
  return geo;
}

const MAX_ENTRIES = 256;

function evictIfNeeded(): void {
  if (cache.size <= MAX_ENTRIES) return;
  // Maps iterate in insertion order — drop the oldest entries.
  const excess = cache.size - MAX_ENTRIES;
  let i = 0;
  for (const [key, geo] of cache) {
    if (i++ >= excess) break;
    geo.dispose();
    cache.delete(key);
  }
}
