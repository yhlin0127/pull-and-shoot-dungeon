import {
  worldPoint,
  type Camera,
  type ScreenPoint,
  type Size,
  type Vec,
  type WorldPoint,
} from './camera';

export type TouchOwner = 'aim' | 'pan';

export type Pull = { anchor: ScreenPoint; finger: ScreenPoint };

export type TouchSequence =
  | { kind: 'idle' }
  | ({ kind: 'aiming' } & Pull)
  | { kind: 'panning'; startCamera: Camera };

export type AimConfig = {
  touchRadius: number;
  minPull: number;
  maxPull: number;
  maxShotDistance: number;
};

export type Aim = { pull: Vec; direction: Vec; power: number; armed: boolean };

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

export function aimFromPull(pull: Pull, config: AimConfig): Aim {
  'worklet';
  const pullX = pull.finger.x - pull.anchor.x;
  const pullY = pull.finger.y - pull.anchor.y;
  const length = Math.hypot(pullX, pullY);
  return {
    pull: { x: pullX, y: pullY },
    direction: length === 0 ? { x: 0, y: 0 } : { x: -pullX / length, y: -pullY / length },
    power: Math.min(length, config.maxPull) / config.maxPull,
    armed: length >= config.minPull,
  };
}

export function resolveRelease(pull: Pull, canceled: boolean, config: AimConfig): AimRelease {
  'worklet';
  const aim = aimFromPull(pull, config);
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
