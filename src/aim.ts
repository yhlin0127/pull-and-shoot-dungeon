import { worldPoint, type Camera, type Size, type Vec, type WorldPoint } from './camera';

export type TouchOwner = 'aim' | 'pan';

export type TouchSequence =
  | { kind: 'idle' }
  | { kind: 'aiming'; anchor: WorldPoint; finger: WorldPoint }
  | { kind: 'panning'; startCamera: Camera };

export type AimConfig = {
  touchRadius: number;
  minPull: number;
  maxPull: number;
  maxShotDistance: number;
};

export type Aim = { direction: Vec; power: number; armed: boolean };

export type Launch = { kind: 'launch'; direction: Vec; power: number };

export type AimRelease = Launch | { kind: 'cancelled'; reason: 'too-short' | 'interrupted' };

export function ownerForTouch(
  touch: WorldPoint,
  player: WorldPoint,
  playerAtRest: boolean,
  config: AimConfig,
): TouchOwner {
  'worklet';
  const distance = Math.hypot(touch.x - player.x, touch.y - player.y);
  return playerAtRest && distance <= config.touchRadius ? 'aim' : 'pan';
}

export function aimFromPull(anchor: WorldPoint, finger: WorldPoint, config: AimConfig): Aim {
  'worklet';
  const pullX = finger.x - anchor.x;
  const pullY = finger.y - anchor.y;
  const pull = Math.hypot(pullX, pullY);
  return {
    direction: pull === 0 ? { x: 0, y: 0 } : { x: -pullX / pull, y: -pullY / pull },
    power: Math.min(pull, config.maxPull) / config.maxPull,
    armed: pull >= config.minPull,
  };
}

export function resolveRelease(
  anchor: WorldPoint,
  finger: WorldPoint,
  canceled: boolean,
  config: AimConfig,
): AimRelease {
  'worklet';
  const aim = aimFromPull(anchor, finger, config);
  if (!aim.armed) {
    return { kind: 'cancelled', reason: 'too-short' };
  }
  if (canceled) {
    return { kind: 'cancelled', reason: 'interrupted' };
  }
  return { kind: 'launch', direction: aim.direction, power: aim.power };
}

function roomAlong(position: number, step: number, min: number, max: number): number {
  'worklet';
  if (step > 0) return (max - position) / step;
  if (step < 0) return (min - position) / step;
  return Infinity;
}

export function shotDestination(
  player: WorldPoint,
  launch: Launch,
  config: AimConfig,
  world: Size,
  playerRadius: number,
): WorldPoint {
  'worklet';
  const { x: dx, y: dy } = launch.direction;
  const room = Math.min(
    roomAlong(player.x, dx, playerRadius, world.width - playerRadius),
    roomAlong(player.y, dy, playerRadius, world.height - playerRadius),
  );
  const distance = Math.min(launch.power * config.maxShotDistance, room);
  return worldPoint(player.x + dx * distance, player.y + dy * distance);
}
