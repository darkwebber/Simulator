/** Involute spur-gear outline math. Pure (no three.js) so it's testable in node.
 *
 * Conventions (ISO-ish, simplified):
 *   pitch radius  r_p = m·N / 2
 *   base radius   r_b = r_p · cos(α), pressure angle α = 20°
 *   root radius   r_r = r_p − 1.25·m
 *   outer radius  r_o = r_p + m
 */

export interface GearDims {
  teeth: number;
  module: number;
  rPitch: number;
  rBase: number;
  rRoot: number;
  rOuter: number;
}

export const PRESSURE_ANGLE = (20 * Math.PI) / 180;

export function gearDims(teeth: number, module: number): GearDims {
  const rPitch = (module * teeth) / 2;
  return {
    teeth,
    module,
    rPitch,
    rBase: rPitch * Math.cos(PRESSURE_ANGLE),
    rRoot: Math.max(rPitch - 1.25 * module, 0.1 * module),
    rOuter: rPitch + module,
  };
}

/** Involute function inv(ψ) = tan ψ − ψ. */
function inv(psi: number): number {
  return Math.tan(psi) - psi;
}

const FLANK_SAMPLES = 7;

/**
 * Full gear outline as a counter-clockwise 2D point loop (x, y pairs).
 * One tooth is centered on polar angle 0, teeth repeat every 2π/N.
 */
export function gearOutline(teeth: number, module: number): Array<[number, number]> {
  const { rPitch, rBase, rRoot, rOuter } = gearDims(teeth, module);
  const halfTooth = Math.PI / (2 * teeth); // half tooth thickness angle at pitch circle
  const invPitch = inv(Math.acos(Math.min(1, rBase / rPitch)));
  const psiOuter = Math.acos(Math.min(1, rBase / rOuter));
  // Polar offset that places the involute's pitch-circle crossing at -halfTooth.
  const delta = -halfTooth - invPitch;

  const points: Array<[number, number]> = [];
  const push = (r: number, angle: number) =>
    points.push([r * Math.cos(angle), r * Math.sin(angle)]);

  for (let k = 0; k < teeth; k++) {
    const center = (k * 2 * Math.PI) / teeth;

    // Root point below the right flank start (radial connection root → base).
    push(rRoot, center + delta);

    // Right flank: involute ascending from base to outer radius.
    for (let s = 0; s <= FLANK_SAMPLES; s++) {
      const psi = (psiOuter * s) / FLANK_SAMPLES;
      const r = rBase / Math.cos(psi);
      push(Math.max(r, rRoot), center + delta + inv(psi));
    }

    // Tip arc (symmetric about the tooth center).
    const tipStart = delta + inv(psiOuter);
    const tipEnd = -tipStart;
    const tipSteps = 3;
    for (let s = 1; s < tipSteps; s++) {
      push(rOuter, center + tipStart + ((tipEnd - tipStart) * s) / tipSteps);
    }

    // Left flank: mirror of the right flank, descending outer → base.
    for (let s = FLANK_SAMPLES; s >= 0; s--) {
      const psi = (psiOuter * s) / FLANK_SAMPLES;
      const r = rBase / Math.cos(psi);
      push(Math.max(r, rRoot), center - delta - inv(psi));
    }

    // Root point after the left flank, then arc to the next tooth.
    push(rRoot, center - delta);
    const nextStart = center + (2 * Math.PI) / teeth + delta;
    const rootSteps = 2;
    for (let s = 1; s < rootSteps; s++) {
      push(rRoot, center - delta + ((nextStart - (center - delta)) * s) / rootSteps);
    }
  }
  return points;
}
