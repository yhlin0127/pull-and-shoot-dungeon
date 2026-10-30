import {
  aimFromPull,
  ownerForTouch,
  resolveRelease,
  shotDestination,
  type Launch,
} from '../src/aim';
import { worldPoint } from '../src/camera';

const config = { touchRadius: 44, minPull: 12, maxPull: 120, maxShotDistance: 360 };
const world = { width: 1200, height: 2000 };
const playerRadius = 18;
const player = worldPoint(600, 1400);

describe('ownerForTouch', () => {
  it('gives aiming to a touch inside the touch target but outside the drawn circle', () => {
    expect(ownerForTouch(worldPoint(630, 1400), player, true, config)).toBe('aim');
  });

  it('gives panning to a touch outside the touch target', () => {
    expect(ownerForTouch(worldPoint(600, 1450), player, true, config)).toBe('pan');
  });

  it('gives panning to a touch on the player while it is moving', () => {
    expect(ownerForTouch(worldPoint(600, 1400), player, false, config)).toBe('pan');
  });
});

describe('aimFromPull', () => {
  it('launches up-left when pulled down-right', () => {
    const aim = aimFromPull(player, worldPoint(660, 1460), config);

    expect(aim.direction.x).toBeCloseTo(-Math.SQRT1_2);
    expect(aim.direction.y).toBeCloseTo(-Math.SQRT1_2);
  });

  it('gives opposite directions for opposite pulls', () => {
    const one = aimFromPull(player, worldPoint(630, 1360), config);
    const other = aimFromPull(player, worldPoint(570, 1440), config);

    expect(other.direction.x).toBeCloseTo(-one.direction.x);
    expect(other.direction.y).toBeCloseTo(-one.direction.y);
  });

  it('gains power with a longer pull and caps it at maxPull', () => {
    const short = aimFromPull(player, worldPoint(600, 1440), config);
    const long = aimFromPull(player, worldPoint(600, 1500), config);
    const atCap = aimFromPull(player, worldPoint(600, 1520), config);
    const beyond = aimFromPull(player, worldPoint(600, 1900), config);

    expect(long.power).toBeGreaterThan(short.power);
    expect(atCap.power).toBe(1);
    expect(beyond.power).toBe(1);
  });

  it('arms only once the pull reaches minPull', () => {
    expect(aimFromPull(player, worldPoint(611, 1400), config).armed).toBe(false);
    expect(aimFromPull(player, worldPoint(612, 1400), config).armed).toBe(true);
  });

  it('measures the pull from where the touch began, not from the player center', () => {
    const offCentre = worldPoint(630, 1400);

    expect(aimFromPull(offCentre, offCentre, config).armed).toBe(false);
  });
});

describe('resolveRelease', () => {
  it('reports a short pull as too short even when the gesture was cancelled', () => {
    expect(resolveRelease(player, worldPoint(605, 1400), true, config)).toEqual({
      kind: 'cancelled',
      reason: 'too-short',
    });
  });

  it('reports a tap that never moved as too short', () => {
    const touch = worldPoint(630, 1400);

    expect(resolveRelease(touch, touch, true, config)).toEqual({
      kind: 'cancelled',
      reason: 'too-short',
    });
  });

  it('reports a valid pull that was cancelled as interrupted', () => {
    expect(resolveRelease(player, worldPoint(600, 1460), true, config)).toEqual({
      kind: 'cancelled',
      reason: 'interrupted',
    });
  });

  it('launches a valid pull with the direction and power the aim showed', () => {
    const finger = worldPoint(600, 1460);
    const release = resolveRelease(player, finger, false, config);
    const shown = aimFromPull(player, finger, config);

    expect(release).toEqual({ kind: 'launch', direction: shown.direction, power: shown.power });
    expect(shown.direction.x).toBeCloseTo(0);
    expect(shown.direction.y).toBeCloseTo(-1);
  });
});

describe('shotDestination', () => {
  const launch = (x: number, y: number, power: number): Launch => ({
    kind: 'launch',
    direction: { x, y },
    power,
  });

  it('travels power times maxShotDistance in open space', () => {
    const destination = shotDestination(
      worldPoint(600, 1000),
      launch(0, -1, 0.5),
      config,
      world,
      playerRadius,
    );

    expect(destination).toEqual({ x: 600, y: 820 });
  });

  it('stops with the circle touching the edge it would cross', () => {
    const destination = shotDestination(
      worldPoint(1150, 1000),
      launch(1, 0, 1),
      config,
      world,
      playerRadius,
    );

    expect(destination).toEqual({ x: 1182, y: 1000 });
  });

  it('stops on the launch line near a corner instead of sliding along the edge', () => {
    const destination = shotDestination(
      worldPoint(1100, 100),
      launch(0.6, -0.8, 1),
      config,
      world,
      playerRadius,
    );

    expect(destination.x).toBeCloseTo(1161.5);
    expect(destination.y).toBeCloseTo(18);
  });
});
