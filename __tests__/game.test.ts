import { worldPoint } from '../src/camera';
import { createGame, enemyId, type Floor, type GameState } from '../src/game/model';
import { PLACEHOLDER_TUNING } from '../src/game/placeholder';

const floor: Floor = {
  bounds: { width: 600, height: 800 },
  walls: [{ x: 0, y: 400, width: 400, height: 24 }],
  spawn: worldPoint(100, 700),
  enemies: [
    { id: enemyId('door'), kind: 'melee', at: worldPoint(500, 600) },
    { id: enemyId('corner'), kind: 'melee', at: worldPoint(300, 150) },
  ],
  objective: { x: 450, y: 50, width: 100, height: 100 },
};

describe('createGame', () => {
  it('places the player at the spawn with the placeholder player stats at full health', () => {
    const { radius, maxHealth, damage } = PLACEHOLDER_TUNING.player;

    expect(createGame(floor).player).toEqual({
      id: 'player',
      position: { x: 100, y: 700 },
      radius,
      maxHealth,
      damage,
      health: maxHealth,
    });
  });

  it("creates one enemy per placement in authored order with its kind's stats at full health", () => {
    const { radius, maxHealth, damage } = PLACEHOLDER_TUNING.enemies.melee;
    const stats = { radius, maxHealth, damage, health: maxHealth };

    expect(createGame(floor).enemies).toEqual([
      { id: 'door', kind: 'melee', position: { x: 500, y: 600 }, ...stats },
      { id: 'corner', kind: 'melee', position: { x: 300, y: 150 }, ...stats },
    ]);
  });

  it('starts on turn 1 in the ready phase', () => {
    const game = createGame(floor);

    expect(game.turn).toBe(1);
    expect(game.phase).toEqual({ kind: 'ready' });
  });

  it('restarts a played game to the same state as a new game on its floor', () => {
    const start = createGame(floor);
    const [door, corner] = start.enemies;
    const played: GameState = {
      ...start,
      turn: 4,
      phase: { kind: 'lost' },
      player: { ...start.player, position: worldPoint(320, 520), health: 0 },
      enemies: [{ ...door, health: 1 }, corner],
    };

    expect(played).not.toEqual(createGame(floor));
    expect(createGame(played.floor)).toEqual(createGame(floor));
  });
});
