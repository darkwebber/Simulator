/** Side-effect module: importing it registers every built-in part type. */

import { registerPart } from './registry';
import { baseplate } from './defs/baseplate';
import { frameBeam } from './defs/frameBeam';
import { axle } from './defs/axle';
import { spurGear } from './defs/spurGear';
import { disc } from './defs/disc';
import { hinge } from './defs/hinge';
import { spring } from './defs/spring';
import { motor } from './defs/motor';

let registered = false;

export function registerBuiltinParts(): void {
  if (registered) return;
  registered = true;
  [baseplate, frameBeam, axle, spurGear, disc, hinge, spring, motor].forEach(
    registerPart,
  );
}

registerBuiltinParts();
