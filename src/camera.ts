export type Vec = { readonly x: number; readonly y: number };
export type ScreenPoint = Vec & { readonly __space: 'screen' };
export type WorldPoint = Vec & { readonly __space: 'world' };
export type Size = { readonly width: number; readonly height: number };
export type Camera = WorldPoint;

export function screenPoint(x: number, y: number): ScreenPoint {
  'worklet';
  return { x, y } as ScreenPoint;
}

export function worldPoint(x: number, y: number): WorldPoint {
  'worklet';
  return { x, y } as WorldPoint;
}

export function screenToWorld(p: ScreenPoint, camera: Camera): WorldPoint {
  'worklet';
  return worldPoint(p.x + camera.x, p.y + camera.y);
}

export function worldToScreen(p: WorldPoint, camera: Camera): ScreenPoint {
  'worklet';
  return screenPoint(p.x - camera.x, p.y - camera.y);
}

function clampAxis(position: number, viewportLength: number, worldLength: number): number {
  'worklet';
  const max = worldLength - viewportLength;
  return max < 0 ? max / 2 : Math.min(Math.max(position, 0), max);
}

export function clampCamera(camera: Camera, viewport: Size, world: Size): Camera {
  'worklet';
  return worldPoint(
    clampAxis(camera.x, viewport.width, world.width),
    clampAxis(camera.y, viewport.height, world.height),
  );
}

export function cameraCenteredOn(target: WorldPoint, viewport: Size, world: Size): Camera {
  'worklet';
  return clampCamera(
    worldPoint(target.x - viewport.width / 2, target.y - viewport.height / 2),
    viewport,
    world,
  );
}
