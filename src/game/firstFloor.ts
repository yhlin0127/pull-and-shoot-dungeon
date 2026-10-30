import { worldPoint } from '../camera';
import { enemyId, type Floor } from './model';

export const FIRST_FLOOR: Floor = {
  bounds: { width: 960, height: 1680 },
  walls: [
    { x: 0, y: 1176, width: 400, height: 24 },
    { x: 560, y: 1176, width: 400, height: 24 },
    // Thinner than the player, within one max launch west of the spawn, for P1-04's thin-wall case.
    { x: 400, y: 1440, width: 8, height: 240 },
    { x: 720, y: 960, width: 80, height: 80 },
    { x: 0, y: 616, width: 840, height: 24 },
    { x: 816, y: 280, width: 24, height: 336 },
    { x: 400, y: 360, width: 80, height: 80 },
  ],
  spawn: worldPoint(680, 1560),
  enemies: [
    { id: enemyId('e1'), kind: 'melee', at: worldPoint(330, 900) },
    { id: enemyId('e2'), kind: 'melee', at: worldPoint(420, 900) },
    { id: enemyId('e3'), kind: 'melee', at: worldPoint(510, 900) },
    { id: enemyId('e4'), kind: 'melee', at: worldPoint(900, 460) },
    { id: enemyId('e5'), kind: 'melee', at: worldPoint(320, 120) },
  ],
  objective: { x: 40, y: 40, width: 160, height: 160 },
};
