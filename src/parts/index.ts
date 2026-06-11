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
import { differential } from './defs/differential';
import { inputDial } from './defs/inputDial';
import { indicatorDrum } from './defs/indicatorDrum';
import { pointerMarker } from './defs/pointerMarker';
import { punchedCard } from './defs/punchedCard';
import { feelerColumn } from './defs/feelerColumn';
import { cordCoupler } from './defs/cordCoupler';
import { scoreRod } from './defs/scoreRod';
import { fallingBar } from './defs/fallingBar';

let registered = false;

export function registerBuiltinParts(): void {
  if (registered) return;
  registered = true;
  [
    baseplate,
    frameBeam,
    axle,
    spurGear,
    disc,
    hinge,
    spring,
    motor,
    differential,
    inputDial,
    indicatorDrum,
    pointerMarker,
    punchedCard,
    feelerColumn,
    cordCoupler,
    scoreRod,
    fallingBar,
  ].forEach(registerPart);
}

registerBuiltinParts();
