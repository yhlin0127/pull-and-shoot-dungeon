import { worldPoint } from '../src/camera';
import { floorProblems } from '../src/game/floorCheck';
import { enemyId, type Floor } from '../src/game/model';

function room(over: Partial<Floor> = {}): Floor {
  return {
    bounds: { width: 600, height: 600 },
    walls: [],
    spawn: worldPoint(100, 500),
    enemies: [],
    objective: { x: 450, y: 50, width: 100, height: 100 },
    ...over,
  };
}

function gapWalls(gap: number) {
  const half = gap / 2;
  return [
    { x: 0, y: 300, width: 300 - half, height: 24 },
    { x: 300 + half, y: 300, width: 300 - half, height: 24 },
  ];
}

describe('floorProblems', () => {
  it('reports no problems for an open room', () => {
    expect(floorProblems(room())).toEqual([]);
  });

  it("reports an enemy overlapping a wall with the wall's index", () => {
    const floor = room({
      walls: [
        { x: 0, y: 0, width: 20, height: 20 },
        { x: 250, y: 300, width: 100, height: 24 },
      ],
      enemies: [{ id: enemyId('e1'), kind: 'melee', at: worldPoint(300, 290) }],
    });

    expect(floorProblems(floor)).toEqual([{ kind: 'entity-in-wall', entity: 'e1', wall: 1 }]);
  });

  it('accepts an enemy exactly touching a wall', () => {
    const floor = room({
      walls: [{ x: 250, y: 300, width: 100, height: 24 }],
      enemies: [{ id: enemyId('e1'), kind: 'melee', at: worldPoint(300, 278) }],
    });

    expect(floorProblems(floor)).toEqual([]);
  });

  it("reports a spawn closer to an edge than the player's radius", () => {
    expect(floorProblems(room({ spawn: worldPoint(10, 500) }))).toEqual([
      { kind: 'entity-out-of-bounds', entity: 'player' },
      { kind: 'objective-unreachable' },
    ]);
  });

  it('reports an enemy overlapping the spawn and two overlapping enemies', () => {
    const onSpawn = room({
      enemies: [{ id: enemyId('e1'), kind: 'melee', at: worldPoint(130, 500) }],
    });
    const pair = room({
      enemies: [
        { id: enemyId('e1'), kind: 'melee', at: worldPoint(300, 300) },
        { id: enemyId('e2'), kind: 'melee', at: worldPoint(300, 340) },
      ],
    });

    expect(floorProblems(onSpawn)).toEqual([
      { kind: 'entities-overlap', entities: ['player', 'e1'] },
    ]);
    expect(floorProblems(pair)).toEqual([
      { kind: 'entities-overlap', entities: ['e1', 'e2'] },
    ]);
  });

  it('reports duplicate enemy ids', () => {
    const floor = room({
      enemies: [
        { id: enemyId('e1'), kind: 'melee', at: worldPoint(300, 300) },
        { id: enemyId('e1'), kind: 'melee', at: worldPoint(400, 300) },
      ],
    });

    expect(floorProblems(floor)).toEqual([{ kind: 'duplicate-id', id: 'e1' }]);
  });

  it('reports the objective unreachable when a 1-point wall crosses the floor', () => {
    const floor = room({ walls: [{ x: 0, y: 300, width: 600, height: 1 }] });

    expect(floorProblems(floor)).toEqual([{ kind: 'objective-unreachable' }]);
  });

  it("closes a gap of the player's diameter and opens a gap one point wider", () => {
    expect(floorProblems(room({ walls: gapWalls(36) }))).toEqual([
      { kind: 'objective-unreachable' },
    ]);
    expect(floorProblems(room({ walls: gapWalls(37) }))).toEqual([]);
  });

  it('rejects a diagonal squeeze between corner-offset walls', () => {
    const floor = room({
      walls: [
        { x: 0, y: 0, width: 300, height: 300 },
        { x: 330, y: 330, width: 270, height: 270 },
      ],
      spawn: worldPoint(500, 100),
      objective: { x: 50, y: 400, width: 200, height: 150 },
    });

    expect(floorProblems(floor)).toEqual([{ kind: 'objective-unreachable' }]);
  });

  it("reports an objective smaller than the player's circle as unreachable", () => {
    const floor = room({ objective: { x: 450, y: 50, width: 30, height: 30 } });

    expect(floorProblems(floor)).toEqual([{ kind: 'objective-unreachable' }]);
  });

  it('does not treat enemies on the only route as blockers', () => {
    const floor = room({
      walls: gapWalls(80),
      enemies: [{ id: enemyId('e1'), kind: 'melee', at: worldPoint(300, 312) }],
    });

    expect(floorProblems(floor)).toEqual([]);
  });

  it('reports an enemy sealed in a pocket the player cannot reach', () => {
    const floor = room({
      walls: [
        { x: 0, y: 200, width: 200, height: 24 },
        { x: 180, y: 0, width: 24, height: 200 },
      ],
      enemies: [{ id: enemyId('e1'), kind: 'melee', at: worldPoint(80, 80) }],
    });

    expect(floorProblems(floor)).toEqual([{ kind: 'enemy-unreachable', entity: 'e1' }]);
  });
});
