import type { Size, WorldPoint } from '../camera';
import { PLACEHOLDER_TUNING } from './placeholder';

export type WorldRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type EnemyId = string & { readonly __brand: 'EnemyId' };
export type EntityId = 'player' | EnemyId;
export type EnemyKind = 'melee';

export function enemyId(raw: string): EnemyId {
  return raw as EnemyId;
}

export type EnemyPlacement = {
  readonly id: EnemyId;
  readonly kind: EnemyKind;
  readonly at: WorldPoint;
};

export type Floor = {
  readonly bounds: Size;
  readonly walls: readonly WorldRect[];
  readonly spawn: WorldPoint;
  readonly enemies: readonly EnemyPlacement[];
  readonly objective: WorldRect;
};

export type Stats = {
  readonly radius: number;
  readonly maxHealth: number;
  readonly damage: number;
};

export type Player = Stats & {
  readonly id: 'player';
  readonly position: WorldPoint;
  readonly health: number;
};

export type Enemy = Stats & {
  readonly id: EnemyId;
  readonly kind: EnemyKind;
  readonly position: WorldPoint;
  readonly health: number;
};

export type TurnPhase =
  | { readonly kind: 'ready' }
  | { readonly kind: 'player-shot' }
  | { readonly kind: 'enemy-turn' }
  | { readonly kind: 'won' }
  | { readonly kind: 'lost' };

export type GameState = {
  readonly floor: Floor;
  readonly turn: number;
  readonly phase: TurnPhase;
  readonly player: Player;
  readonly enemies: readonly Enemy[];
};

export function createGame(floor: Floor): GameState {
  const playerStats = PLACEHOLDER_TUNING.player;
  return {
    floor,
    turn: 1,
    phase: { kind: 'ready' },
    player: { id: 'player', position: floor.spawn, ...playerStats, health: playerStats.maxHealth },
    enemies: floor.enemies.map(({ id, kind, at }) => {
      const stats = PLACEHOLDER_TUNING.enemies[kind];
      return { id, kind, position: at, ...stats, health: stats.maxHealth };
    }),
  };
}
