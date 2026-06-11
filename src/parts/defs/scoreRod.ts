import * as THREE from 'three';
import { cylinderGeometry, merged } from '@/geometry/primitives';
import type { PartDefinition, PartProps } from '../partDefinition';
import { num } from '../partDefinition';

/**
 * Score rod of the mechanical MNIST classifier: one per digit. The rod slides
 * vertically in a guide (prismatic); its integral cord drum winds every cord
 * laced to it, so the rod's height is the digit's score:
 *
 *   y = feed · Σ weight·θ_feeler + rest height
 *
 * The bias is the rest cord length — set the rod's height at assembly, it
 * costs no moving parts. The falling bar settles on the tallest rod.
 */

const textureCache = new Map<string, THREE.Texture>();

function digitTexture(digit: number): THREE.Texture {
  const key = `rod${digit}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const W = 256;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#8a7430';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f4ecd8';
  ctx.font = 'bold 96px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // The digit, repeated down the rod so it reads at any height.
  for (let y = 64; y < H; y += 128) ctx.fillText(String(digit), W / 2, y);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  textureCache.set(key, texture);
  return texture;
}

function digitOf(props: PartProps): number {
  return Math.max(0, Math.min(9, Math.round(num(props, 'digit', 0))));
}

export const scoreRod: PartDefinition = {
  type: 'scoreRod',
  label: 'Score rod',
  category: 'mechanism',
  description:
    'Sliding rod whose height is a weighted sum of the feeler rotations laced to its ' +
    'drum (feed cm per radian per unit weight). Guide it with a prismatic bearing.',
  defaultProps: { digit: 0, length: 10, radius: 0.5, feed: 0.075 },
  propSchema: [
    { key: 'digit', label: 'Digit', type: 'number', min: 0, max: 9, step: 1, integer: true },
    { key: 'length', label: 'Length', type: 'number', min: 4, max: 30, step: 1, unit: 'cm' },
    { key: 'radius', label: 'Radius', type: 'number', min: 0.3, max: 1.2, step: 0.05, unit: 'cm' },
    { key: 'feed', label: 'Drum feed', type: 'number', min: 0.01, max: 0.5, step: 0.005, unit: 'cm/rad' },
  ],
  getAnchors(props) {
    const len = num(props, 'length', 10);
    return [
      {
        id: 'slide',
        kind: 'axle-socket',
        position: [0, 0, 0],
        axis: [0, 1, 0],
        defaultConnection: 'prismatic',
      },
      {
        id: 'drum',
        kind: 'spring-eye',
        position: [0, -len / 2 + 0.5, 0],
        axis: [0, 1, 0],
        defaultConnection: 'cord',
      },
    ];
  },
  buildGeometry(props) {
    // Plain cylinder so the digit side-texture maps onto the shaft.
    return cylinderGeometry(num(props, 'radius', 0.5), num(props, 'length', 10), 24);
  },
  // Contact cap on top (what the falling bar lands on) + the cord drum below.
  buildAccentGeometry(props) {
    const len = num(props, 'length', 10);
    const r = num(props, 'radius', 0.5);
    return merged([
      { geometry: cylinderGeometry(r + 0.25, 0.35, 20), position: [0, len / 2 + 0.175, 0] },
      { geometry: cylinderGeometry(r + 0.2, 0.6, 16), position: [0, -len / 2 + 0.5, 0] },
    ]);
  },
  accentColor: () => '#c9a14f',
  buildColliders(props) {
    const len = num(props, 'length', 10);
    const r = num(props, 'radius', 0.5);
    return [
      { shape: 'cylinder', halfHeight: len / 2, radius: r, offset: { position: [0, 0, 0], rotation: [0, 0, 0, 1] } },
      // The cap is real contact hardware.
      {
        shape: 'cylinder',
        halfHeight: 0.175,
        radius: r + 0.25,
        offset: { position: [0, len / 2 + 0.175, 0], rotation: [0, 0, 0, 1] },
      },
    ];
  },
  // Heavy brass: the featherweight bar must read the rod, not deflect it.
  physical: () => ({ density: 0.08, friction: 0.6, restitution: 0 }),
  visual: () => ({ color: '#b89a3e', metalness: 0.55, roughness: 0.45 }),
  buildSideTexture(props) {
    return digitTexture(digitOf(props));
  },
  simTags: ['scoreRod'],
};
