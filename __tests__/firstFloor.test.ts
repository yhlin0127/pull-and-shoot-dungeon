import { floorProblems } from '../src/game/floorCheck';
import { FIRST_FLOOR } from '../src/game/firstFloor';
import { PLACEHOLDER_TUNING } from '../src/game/placeholder';

type Point = { readonly x: number; readonly y: number };
type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

function distanceToRect(point: Point, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const cross = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const ab = cross(a, b, c) * cross(a, b, d);
  const cd = cross(c, d, a) * cross(c, d, b);
  return ab < 0 && cd < 0;
}

function segmentHitsRect(start: Point, end: Point, rect: Rect): boolean {
  if (distanceToRect(start, rect) === 0 || distanceToRect(end, rect) === 0) return true;
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  return corners.some((corner, index) =>
    segmentsCross(start, end, corner, corners[(index + 1) % corners.length]),
  );
}

function distanceSegmentToRect(start: Point, end: Point, rect: Rect): number {
  if (segmentHitsRect(start, end, rect)) return 0;
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  return Math.min(
    distanceToRect(start, rect),
    distanceToRect(end, rect),
    ...corners.map((corner) => distanceToSegment(corner, start, end)),
  );
}

describe('FIRST_FLOOR', () => {
  it('has no floor problems', () => {
    expect(floorProblems(FIRST_FLOOR)).toEqual([]);
  });

  it('is larger than the 402 x 874 reference viewport on both axes', () => {
    expect(FIRST_FLOOR.bounds.width).toBeGreaterThan(402);
    expect(FIRST_FLOOR.bounds.height).toBeGreaterThan(874);
  });

  it('lets one max launch east from (290, 900) touch e1, e2, and e3 without hitting a wall', () => {
    const radius = PLACEHOLDER_TUNING.player.radius;
    const reach = radius + PLACEHOLDER_TUNING.enemies.melee.radius;
    const start = { x: 290, y: 900 };
    const end = { x: start.x + PLACEHOLDER_TUNING.launch.maxDistance, y: start.y };

    for (const id of ['e1', 'e2', 'e3']) {
      const enemy = FIRST_FLOOR.enemies.find((placement) => placement.id === id);
      expect(enemy).toEqual(expect.objectContaining({ id }));
      if (enemy === undefined) continue;
      expect(distanceToSegment(enemy.at, start, end)).toBeLessThanOrEqual(reach);
    }

    for (const wall of FIRST_FLOOR.walls) {
      expect(distanceSegmentToRect(start, end, wall)).toBeGreaterThanOrEqual(radius);
    }
  });

  it("has one wall thinner than the player's radius", () => {
    const thin = FIRST_FLOOR.walls.filter(
      (wall) => Math.min(wall.width, wall.height) < PLACEHOLDER_TUNING.player.radius,
    );

    expect(thin).toEqual([{ x: 400, y: 1440, width: 8, height: 240 }]);
  });
});
