import type { EnemyKind, Stats } from './model';

// These numbers are placeholders because D05, D06, and D07 in docs/GAME-PLAN.md are still open.
// P1-09 tunes them.
export const PLACEHOLDER_TUNING = {
  player: { radius: 18, maxHealth: 5, damage: 1 },
  enemies: { melee: { radius: 22, maxHealth: 2, damage: 1 } },
  launch: { maxDistance: 360 },
} as const satisfies {
  player: Stats;
  enemies: Record<EnemyKind, Stats>;
  launch: { maxDistance: number };
};
