import type { WorldPoint } from '../camera';
import { createGame, type EnemyId, type EntityId, type Floor, type WorldRect } from './model';

export type FloorProblem =
  | { readonly kind: 'duplicate-id'; readonly id: EnemyId }
  | { readonly kind: 'entity-out-of-bounds'; readonly entity: EntityId }
  | { readonly kind: 'entity-in-wall'; readonly entity: EntityId; readonly wall: number }
  | { readonly kind: 'entities-overlap'; readonly entities: readonly [EntityId, EntityId] }
  | { readonly kind: 'objective-unreachable' }
  | { readonly kind: 'enemy-unreachable'; readonly entity: EnemyId };

export function floorProblems(floor: Floor): readonly FloorProblem[] {
  const problems: FloorProblem[] = [];

  const ids = new Set<EntityId>(['player']);
  for (const { id } of floor.enemies) {
    if (ids.has(id)) problems.push({ kind: 'duplicate-id', id });
    ids.add(id);
  }

  const { player, enemies } = createGame(floor);
  const entities = [player, ...enemies];
  const { width, height } = floor.bounds;
  for (const { id, position, radius } of entities) {
    const { x, y } = position;
    if (x < radius || y < radius || x > width - radius || y > height - radius) {
      problems.push({ kind: 'entity-out-of-bounds', entity: id });
    }
    floor.walls.forEach((wall, index) => {
      if (distanceToRect(position, wall) < radius) {
        problems.push({ kind: 'entity-in-wall', entity: id, wall: index });
      }
    });
  }
  entities.forEach((a, index) => {
    for (const b of entities.slice(index + 1)) {
      const apart = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
      if (apart < a.radius + b.radius) {
        problems.push({ kind: 'entities-overlap', entities: [a.id, b.id] });
      }
    }
  });

  const reached = reachableCells(floor, player.radius);
  const goal = grow(floor.objective, -player.radius);
  if (!reached.some((cell) => overlapsWithArea(cell, goal))) {
    problems.push({ kind: 'objective-unreachable' });
  }
  for (const enemy of enemies) {
    const touching = player.radius + enemy.radius;
    if (!reached.some((cell) => distanceToRect(enemy.position, cell) < touching)) {
      problems.push({ kind: 'enemy-unreachable', entity: enemy.id });
    }
  }

  return problems;
}

function distanceToRect(point: WorldPoint, rect: WorldRect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

function grow(rect: WorldRect, by: number): WorldRect {
  return {
    x: rect.x - by,
    y: rect.y - by,
    width: rect.width + 2 * by,
    height: rect.height + 2 * by,
  };
}

function overlapsWithArea(a: WorldRect, b: WorldRect): boolean {
  return (
    Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) &&
    Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y)
  );
}

function cutLines(low: number, high: number, edges: readonly number[]): readonly number[] {
  const inside = edges.filter((edge) => edge > low && edge < high);
  return [...new Set([low, ...inside, high])].sort((a, b) => a - b);
}

function spansOf(lines: readonly number[], value: number): readonly number[] {
  return lines
    .slice(1)
    .flatMap((end, index) => (lines[index] <= value && value <= end ? [index] : []));
}

// Searches for the square of side 2 * radius around the player instead of its circle. The square
// contains the circle, so every route found is one the circle can travel, but a diagonal squeeze
// where both axis gaps are under 2 * radius is rejected even when the circle would fit.
function reachableCells(floor: Floor, radius: number): readonly WorldRect[] {
  const { width, height } = floor.bounds;
  if (width <= 2 * radius || height <= 2 * radius) return [];

  const blocked = floor.walls.map((wall) => grow(wall, radius));
  const xs = cutLines(radius, width - radius, blocked.flatMap((b) => [b.x, b.x + b.width]));
  const ys = cutLines(radius, height - radius, blocked.flatMap((b) => [b.y, b.y + b.height]));
  const isFree = (column: number, row: number) => {
    const x = (xs[column] + xs[column + 1]) / 2;
    const y = (ys[row] + ys[row + 1]) / 2;
    return !blocked.some((b) => x > b.x && x < b.x + b.width && y > b.y && y < b.y + b.height);
  };

  const queue: (readonly [number, number])[] = [];
  const seen = new Set<number>();
  const visit = (column: number, row: number) => {
    const key = column * ys.length + row;
    if (column < 0 || row < 0 || column >= xs.length - 1 || row >= ys.length - 1) return;
    if (seen.has(key) || !isFree(column, row)) return;
    seen.add(key);
    queue.push([column, row]);
  };

  for (const column of spansOf(xs, floor.spawn.x)) {
    for (const row of spansOf(ys, floor.spawn.y)) visit(column, row);
  }
  for (let next = 0; next < queue.length; next += 1) {
    const [column, row] = queue[next];
    visit(column + 1, row);
    visit(column - 1, row);
    visit(column, row + 1);
    visit(column, row - 1);
  }

  return queue.map(([column, row]) => ({
    x: xs[column],
    y: ys[row],
    width: xs[column + 1] - xs[column],
    height: ys[row + 1] - ys[row],
  }));
}
