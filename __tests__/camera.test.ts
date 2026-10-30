import {
  cameraCenteredOn,
  clampCamera,
  screenPoint,
  screenToWorld,
  worldPoint,
  worldToScreen,
} from '../src/camera';

const world = { width: 1200, height: 2000 };
const viewport = { width: 400, height: 800 };

describe('screen and world conversion', () => {
  it('maps a screen point to the world point offset by the camera', () => {
    const camera = worldPoint(400, 900);

    expect(screenToWorld(screenPoint(100, 50), camera)).toEqual({ x: 500, y: 950 });
    expect(worldToScreen(worldPoint(500, 950), camera)).toEqual({ x: 100, y: 50 });
  });

  it('round-trips a screen point through world space', () => {
    const camera = worldPoint(123.5, 987.25);
    const touch = screenPoint(37.5, 612);

    expect(worldToScreen(screenToWorld(touch, camera), camera)).toEqual(touch);
  });

  it('shifts the world point under a fixed screen point by exactly the camera move', () => {
    const touch = screenPoint(200, 300);
    const before = screenToWorld(touch, worldPoint(300, 700));
    const after = screenToWorld(touch, worldPoint(300 + 45, 700 - 120));

    expect(after.x - before.x).toBe(45);
    expect(after.y - before.y).toBe(-120);
  });
});

describe('clampCamera', () => {
  it('leaves a camera that already shows only the world unchanged', () => {
    expect(clampCamera(worldPoint(300, 600), viewport, world)).toEqual({ x: 300, y: 600 });
  });

  it('stops the viewport at the left and top edges', () => {
    expect(clampCamera(worldPoint(-50, -30), viewport, world)).toEqual({ x: 0, y: 0 });
  });

  it('stops the viewport at the right and bottom edges', () => {
    expect(clampCamera(worldPoint(1000, 1500), viewport, world)).toEqual({ x: 800, y: 1200 });
  });

  it('centers a world narrower than the viewport', () => {
    const wide = { width: 1600, height: 800 };

    expect(clampCamera(worldPoint(0, 0), wide, world).x).toBe(-200);
  });
});

describe('cameraCenteredOn', () => {
  it('puts the target in the middle of the viewport', () => {
    expect(cameraCenteredOn(worldPoint(600, 1000), viewport, world)).toEqual({ x: 400, y: 600 });
  });

  it('stays inside the world when the target is near a corner', () => {
    expect(cameraCenteredOn(worldPoint(30, 1990), viewport, world)).toEqual({ x: 0, y: 1200 });
  });
});
