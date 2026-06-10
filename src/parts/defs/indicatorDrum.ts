import * as THREE from 'three';
import { cylinderGeometry } from '@/geometry/primitives';
import type { PartDefinition, PartProps } from '../partDefinition';
import { num } from '../partDefinition';

/**
 * Binary encoder drum: 32 sectors around the rim, painted with one bit of the
 * sector index (or the index itself in decimal mode). Keyed onto a readout
 * shaft geared so that one unit of the machine's result = 1/32 turn, a stack
 * of these displays the result in binary — the read-out side of mechanical
 * digital computing, with no electrical parts.
 *
 * Sector painting accounts for the drum's rotation sense: a value V turns the
 * shaft by +V·2π/32 about +Y, bringing the sector painted at azimuth −V·2π/32
 * under a fixed pointer placed on the drum's +Z side.
 */

const SECTORS = 32;

const PATTERN_OPTIONS = [
  { value: 'bit0', label: 'Bit 0 (1s)' },
  { value: 'bit1', label: 'Bit 1 (2s)' },
  { value: 'bit2', label: 'Bit 2 (4s)' },
  { value: 'bit3', label: 'Bit 3 (8s)' },
  { value: 'bit4', label: 'Bit 4 (16s)' },
  { value: 'decimal', label: 'Decimal 0–31' },
];

function sectorLabel(pattern: string, sector: number): string {
  if (pattern === 'decimal') return String(sector);
  const bit = Number(pattern.replace('bit', ''));
  return String((sector >> bit) & 1);
}

function sectorOn(pattern: string, sector: number): boolean {
  if (pattern === 'decimal') return sector % 2 === 1;
  const bit = Number(pattern.replace('bit', ''));
  return ((sector >> bit) & 1) === 1;
}

const textureCache = new Map<string, THREE.Texture>();

function drumTexture(pattern: string): THREE.Texture {
  const cached = textureCache.get(pattern);
  if (cached) return cached;

  const W = 2048;
  const H = 128;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const sw = W / SECTORS;

  ctx.fillStyle = '#23282e';
  ctx.fillRect(0, 0, W, H);

  for (let v = 0; v < SECTORS; v++) {
    // Sector v sits under the pointer when the drum has turned +v/32 of a
    // revolution, i.e. it must be painted centered at u = (1 − v/32) mod 1.
    const cx = ((1 - v / SECTORS) % 1) * W;
    const on = sectorOn(pattern, v);
    ctx.fillStyle = on ? '#2e7d4f' : '#2b3139';
    for (const x of [cx, cx - W, cx + W]) {
      if (x + sw / 2 < 0 || x - sw / 2 > W) continue;
      ctx.fillRect(x - sw / 2 + 1, 4, sw - 2, H - 8);
    }
    ctx.fillStyle = on ? '#d9ffe8' : '#9aa6b2';
    ctx.font =
      pattern === 'decimal' ? 'bold 56px system-ui, sans-serif' : 'bold 84px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const x of [cx, cx - W, cx + W]) {
      if (x < -sw || x > W + sw) continue;
      ctx.fillText(sectorLabel(pattern, v), x, H / 2 + 2);
    }
  }
  // Sector separators.
  ctx.strokeStyle = '#161a1e';
  ctx.lineWidth = 2;
  for (let s = 0; s < SECTORS; s++) {
    const x = ((1 - (s + 0.5) / SECTORS) % 1) * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.wrapS = THREE.RepeatWrapping;
  textureCache.set(pattern, texture);
  return texture;
}

function patternOf(props: PartProps): string {
  const p = props.pattern;
  return typeof p === 'string' ? p : 'bit0';
}

export const indicatorDrum: PartDefinition = {
  type: 'indicatorDrum',
  label: 'Indicator drum',
  category: 'mechanism',
  description:
    '32-sector binary encoder drum. Key a stack onto a readout shaft (1 unit = 1/32 turn) to display a number in binary.',
  defaultProps: { pattern: 'bit0', radius: 5.5, height: 1.8 },
  propSchema: [
    { key: 'pattern', label: 'Pattern', type: 'select', options: PATTERN_OPTIONS },
    { key: 'radius', label: 'Radius', type: 'number', min: 2, max: 10, step: 0.5, unit: 'cm' },
    { key: 'height', label: 'Height', type: 'number', min: 1, max: 4, step: 0.2, unit: 'cm' },
  ],
  getAnchors() {
    return [
      {
        id: 'bore',
        kind: 'axle-socket',
        position: [0, 0, 0],
        axis: [0, 1, 0],
        defaultConnection: 'revolute',
        connectionProps: { keyed: true },
      },
    ];
  },
  buildGeometry(props) {
    return cylinderGeometry(num(props, 'radius', 5.5), num(props, 'height', 1.8), 64);
  },
  buildColliders(props) {
    return [
      {
        shape: 'cylinder',
        halfHeight: num(props, 'height', 1.8) / 2,
        radius: num(props, 'radius', 5.5),
        offset: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
      },
    ];
  },
  physical: () => ({ density: 0.002, friction: 0.5, restitution: 0.1 }),
  visual: () => ({ color: '#39424c', metalness: 0.4, roughness: 0.6 }),
  buildSideTexture(props) {
    return drumTexture(patternOf(props));
  },
};
