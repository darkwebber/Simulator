/** Registry conformance: every part type must be internally consistent —
 * schema ↔ defaults, unique anchors with unit axes that sit on the part's
 * visible geometry, valid colliders and physicals. Catches "doesn't fit"
 * bugs (anchors floating in space, missing defaults) for current and future
 * parts automatically. */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import './index';
import { listPartDefs } from './registry';
import { anchorsCompatible } from '@/editor/snapping';

const defs = listPartDefs();

describe.each(defs.map((d) => [d.type, d] as const))('part %s', (_type, def) => {
  const props = { ...def.defaultProps };

  it('schema and defaults agree', () => {
    for (const spec of def.propSchema) {
      expect(def.defaultProps, `default for prop '${spec.key}'`).toHaveProperty(spec.key);
      const value = def.defaultProps[spec.key];
      if (spec.type === 'number') {
        expect(typeof value).toBe('number');
        if (spec.min !== undefined) expect(value as number).toBeGreaterThanOrEqual(spec.min);
        if (spec.max !== undefined) expect(value as number).toBeLessThanOrEqual(spec.max);
      }
      if (spec.type === 'boolean') expect(typeof value).toBe('boolean');
      if (spec.type === 'select') {
        expect(spec.options.map((o) => o.value)).toContain(value);
      }
    }
  });

  it('anchors are unique, unit-axis, and sit on the part', () => {
    const anchors = def.getAnchors(props);
    const ids = anchors.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);

    // Union bounding box of main + accent geometry.
    const box = new THREE.Box3();
    const main = def.buildGeometry(props);
    main.computeBoundingBox();
    box.union(main.boundingBox!);
    const accent = def.buildAccentGeometry?.(props);
    if (accent) {
      accent.computeBoundingBox();
      box.union(accent.boundingBox!);
    }
    box.expandByScalar(0.35);

    for (const a of anchors) {
      const len = Math.hypot(...a.axis);
      expect(Math.abs(len - 1), `axis of anchor '${a.id}' must be unit`).toBeLessThan(1e-6);
      expect(
        box.containsPoint(new THREE.Vector3(...a.position)),
        `anchor '${a.id}' at [${a.position}] must lie on the part (bbox ${JSON.stringify(box)})`,
      ).toBe(true);
      // Every anchor kind must be connectable to something.
      const partners = (['axle-shaft', 'axle-socket', 'mount-hole', 'mount-peg', 'spring-eye'] as const)
        .filter((k) => anchorsCompatible(a.kind, k));
      expect(partners.length, `anchor kind '${a.kind}' has no compatible partner`).toBeGreaterThan(0);
    }
  });

  it('has valid colliders and physical properties', () => {
    const colliders = def.buildColliders(props);
    expect(colliders.length).toBeGreaterThan(0);
    for (const c of colliders) {
      if (c.shape === 'cuboid') c.halfExtents.forEach((e) => expect(e).toBeGreaterThan(0));
      if (c.shape === 'cylinder') {
        expect(c.halfHeight).toBeGreaterThan(0);
        expect(c.radius).toBeGreaterThan(0);
      }
      if (c.shape === 'ball') expect(c.radius).toBeGreaterThan(0);
    }
    const phys = def.physical(props);
    expect(phys.density).toBeGreaterThan(0);
    expect(phys.friction).toBeGreaterThanOrEqual(0);
    expect(phys.restitution).toBeGreaterThanOrEqual(0);
    expect(phys.restitution).toBeLessThanOrEqual(1);
  });

  it('builds non-empty geometry', () => {
    const geo = def.buildGeometry(props);
    expect(geo.attributes.position.count).toBeGreaterThan(0);
  });
});
