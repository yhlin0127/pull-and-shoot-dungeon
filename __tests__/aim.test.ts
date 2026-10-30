import {
  aimFromPull,
  ownerForTouch,
  resolveRelease,
  shotDestination,
  type Launch,
  type Pull,
} from '../src/aim';
import { screenPoint, worldPoint } from '../src/camera';

const config = { touchRadius: 44, minPull: 12, maxPull: 120, maxShotDistance: 360 };
const world = { width: 1200, height: 2000 };
const playerRadius = 18;
const player = worldPoint(600, 1400);
const anchor = screenPoint(160, 520);
const pullTo = (x: number, y: number): Pull => ({ anchor, finger: screenPoint(x, y) });

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
    const aim = aimFromPull(pullTo(220, 580), config);

    expect(aim.direction.x).toBeCloseTo(-Math.SQRT1_2);
    expect(aim.direction.y).toBeCloseTo(-Math.SQRT1_2);
  });

  it('gives opposite directions for opposite pulls', () => {
    const one = aimFromPull(pullTo(190, 480), config);
    const other = aimFromPull(pullTo(130, 560), config);

    expect(other.direction.x).toBeCloseTo(-one.direction.x);
    expect(other.direction.y).toBeCloseTo(-one.direction.y);
  });

  it('gains power with a longer pull and caps it at maxPull', () => {
    const short = aimFromPull(pullTo(160, 560), config);
    const long = aimFromPull(pullTo(160, 620), config);
    const atCap = aimFromPull(pullTo(160, 640), config);
    const beyond = aimFromPull(pullTo(160, 1020), config);

    expect(long.power).toBeGreaterThan(short.power);
    expect(atCap.power).toBe(1);
    expect(beyond.power).toBe(1);
  });

  it('arms only once the pull reaches minPull', () => {
    expect(aimFromPull(pullTo(171, 520), config).armed).toBe(false);
    expect(aimFromPull(pullTo(172, 520), config).armed).toBe(true);
  });

  it('measures the pull from where the touch began, not from the player center', () => {
    const offCentre = screenPoint(630, 1400);

    expect(aimFromPull({ anchor: offCentre, finger: offCentre }, config).armed).toBe(false);
  });

  it('depends only on how far the finger travelled, not where it began', () => {
    const here = aimFromPull(
      { anchor: screenPoint(160, 520), finger: screenPoint(220, 580) },
      config,
    );
    const there = aimFromPull(
      { anchor: screenPoint(10, 40), finger: screenPoint(70, 100) },
      config,
    );

    expect(there).toEqual(here);
  });

  it('takes screen samples only', () => {
    // @ts-expect-error
    aimFromPull({ anchor: worldPoint(680, 1560), finger: worldPoint(680, 1620) }, config);
  });
});

describe('resolveRelease', () => {
  it('reports a short pull as too short even when the gesture was cancelled', () => {
    expect(resolveRelease(pullTo(165, 520), true, config)).toEqual({
      kind: 'cancelled',
      reason: 'too-short',
    });
  });

  it('reports a tap that never moved as too short', () => {
    const touch = pullTo(160, 520);

    expect(resolveRelease(touch, true, config)).toEqual({
      kind: 'cancelled',
      reason: 'too-short',
    });
  });

  it('reports a valid pull that was cancelled as interrupted', () => {
    expect(resolveRelease(pullTo(160, 580), true, config)).toEqual({
      kind: 'cancelled',
      reason: 'interrupted',
    });
  });

  it('launches a valid pull with the direction and power the aim showed', () => {
    const pull = pullTo(160, 580);
    const release = resolveRelease(pull, false, config);
    const shown = aimFromPull(pull, config);

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
