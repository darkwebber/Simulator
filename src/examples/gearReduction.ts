/** Bundled example: a motor spins an 8-tooth pinion that drives a 24-tooth
 * gear (exact 3:1 reduction, counter-rotating) on a post-mounted vertical
 * axle. A loose disc sits on the plate to show gravity and contact.
 *
 * Heights (cm): plate top 0.5 → motor center 2.0, coupling at 4.1.
 * Axle 1 (len 8) spans 4.1–12.1; gears mesh at y = 9.1.
 * Post (h 7.6) top bearing at 8.1; axle 2 (len 6) spans 8.1–14.1.
 */

import type { MachineDocument } from '@/model/types';

export function gearReductionDemo(): MachineDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    meta: { name: 'Demo — 3:1 gear reduction', createdAt: now, modifiedAt: now },
    settings: { gravity: [0, -981, 0], gridSize: 0.5 },
    parts: [
      {
        id: 'plate',
        type: 'baseplate',
        name: 'Baseplate',
        props: { width: 24, depth: 24, thickness: 1, holeSpacing: 2 },
        transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
      },
      {
        id: 'motor',
        type: 'motor',
        name: 'Motor',
        props: { speed: 30, maxTorque: 20000, reversed: false },
        transform: { position: [-5, 2, -1], rotation: [0, 0, 0, 1] },
      },
      {
        id: 'axle1',
        type: 'axle',
        name: 'Motor axle',
        props: { length: 8, radius: 0.4 },
        transform: { position: [-5, 8.1, -1], rotation: [0, 0, 0, 1] },
      },
      {
        id: 'gearA',
        type: 'spurGear',
        name: 'Pinion 8T',
        props: { teeth: 8, module: 0.5, width: 1, bore: 0.4, keyed: true },
        transform: { position: [-5, 9.1, -1], rotation: [0, 0, 0, 1] },
      },
      {
        id: 'post',
        type: 'frameBeam',
        name: 'Bearing post',
        props: { height: 7.6, width: 1.6, depth: 1.6 },
        transform: { position: [3, 4.3, -1], rotation: [0, 0, 0, 1] },
      },
      {
        id: 'axle2',
        type: 'axle',
        name: 'Output axle',
        props: { length: 6, radius: 0.4 },
        transform: { position: [3, 11.1, -1], rotation: [0, 0, 0, 1] },
      },
      {
        id: 'gearB',
        type: 'spurGear',
        name: 'Wheel 24T',
        props: { teeth: 24, module: 0.5, width: 1, bore: 0.4, keyed: true },
        transform: { position: [3, 9.1, -1], rotation: [0, 0, 0, 1] },
      },
      {
        id: 'weight',
        type: 'disc',
        name: 'Loose disc',
        props: { radius: 2, thickness: 1, bore: 0.4, keyed: false },
        transform: { position: [-5, 1.0, 7], rotation: [0, 0, 0, 1] },
      },
    ],
    connections: [
      {
        id: 'c_motor_plate',
        kind: 'fixed',
        a: { partId: 'motor', anchorId: 'peg' },
        b: { partId: 'plate', anchorId: 'hole_3_5' },
        props: {},
      },
      {
        id: 'c_motor_axle',
        kind: 'revolute',
        a: { partId: 'motor', anchorId: 'output' },
        b: { partId: 'axle1', anchorId: 'shaft_0' },
        props: { motor: true },
      },
      {
        id: 'c_gearA',
        kind: 'revolute',
        a: { partId: 'gearA', anchorId: 'bore' },
        b: { partId: 'axle1', anchorId: 'shaft_5' },
        props: { keyed: true },
      },
      {
        id: 'c_post_plate',
        kind: 'fixed',
        a: { partId: 'post', anchorId: 'peg' },
        b: { partId: 'plate', anchorId: 'hole_7_5' },
        props: {},
      },
      {
        id: 'c_axle2_post',
        kind: 'revolute',
        a: { partId: 'axle2', anchorId: 'shaft_0' },
        b: { partId: 'post', anchorId: 'bearing_top' },
        props: {},
      },
      {
        id: 'c_gearB',
        kind: 'revolute',
        a: { partId: 'gearB', anchorId: 'bore' },
        b: { partId: 'axle2', anchorId: 'shaft_1' },
        props: { keyed: true },
      },
    ],
  };
}
