import { Canvas, Circle, Group, Path, Rect } from '@shopify/react-native-skia';
import { useReducer } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import {
  aimFromPull,
  ownerForTouch,
  resolveRelease,
  shotDestination,
  type Aim,
  type AimRelease,
  type TouchOwner,
  type TouchSequence,
} from './aim';
import {
  cameraCenteredOn,
  clampCamera,
  screenPoint,
  screenToWorld,
  worldPoint,
  type Camera,
  type ScreenPoint,
  type Size,
  type Vec,
  type WorldPoint,
} from './camera';

const TUNING = {
  world: { width: 1200, height: 2000 },
  spawn: worldPoint(600, 1400),
  playerRadius: 18,
  aim: { touchRadius: 44, minPull: 12, maxPull: 120, maxShotDistance: 360 },
  shotMs: 600,
  recenterMs: 400,
  arrowLengthAtFullPower: 140,
  arrowHead: 14,
  gridSpacing: 100,
};

const LANDMARKS = [
  { x: 240, y: 300, r: 48 },
  { x: 980, y: 620, r: 64 },
  { x: 760, y: 1180, r: 40 },
  { x: 330, y: 1720, r: 56 },
];

const COLORS = {
  floor: '#ece7dc',
  grid: '#d3ccbd',
  border: '#4a453d',
  landmark: '#a9a49b',
  player: '#2f6fde',
  playerOutline: '#0b1f4a',
  pull: 'rgba(30, 30, 30, 0.25)',
  armed: '#e8590c',
  unarmed: 'rgba(110, 110, 110, 0.55)',
};

const IDLE: TouchSequence = { kind: 'idle' };

function gridPath({ width, height }: Size, spacing: number): string {
  const lines: string[] = [];
  for (let x = spacing; x < width; x += spacing) lines.push(`M ${x} 0 L ${x} ${height}`);
  for (let y = spacing; y < height; y += spacing) lines.push(`M 0 ${y} L ${width} ${y}`);
  return lines.join(' ');
}

const GRID_PATH = gridPath(TUNING.world, TUNING.gridSpacing);

function arrowPath(player: WorldPoint, aim: Aim): string {
  'worklet';
  const { x: dx, y: dy } = aim.direction;
  const tailX = player.x + dx * TUNING.playerRadius;
  const tailY = player.y + dy * TUNING.playerRadius;
  const length = aim.power * TUNING.arrowLengthAtFullPower;
  const tipX = tailX + dx * length;
  const tipY = tailY + dy * length;
  const backX = tipX - dx * TUNING.arrowHead;
  const backY = tipY - dy * TUNING.arrowHead;
  const wingX = -dy * TUNING.arrowHead * 0.6;
  const wingY = dx * TUNING.arrowHead * 0.6;
  return (
    `M ${tailX} ${tailY} L ${tipX} ${tipY} ` +
    `M ${backX + wingX} ${backY + wingY} L ${tipX} ${tipY} L ${backX - wingX} ${backY - wingY}`
  );
}

type TouchStart = { owner: TouchOwner; screen: ScreenPoint; world: WorldPoint };

type PlayfieldEvent =
  | { type: 'touch-start'; touch: TouchStart }
  | { type: 'released'; release: AimRelease }
  | { type: 'camera-settled'; camera: Camera }
  | { type: 'shot-landed'; player: WorldPoint };

type Hud = {
  camera: Camera;
  player: WorldPoint;
  touch: TouchStart | null;
  shot: AimRelease | null;
  shotsFired: number;
};

function hudReducer(hud: Hud, event: PlayfieldEvent): Hud {
  switch (event.type) {
    case 'touch-start':
      return { ...hud, touch: event.touch };
    case 'released':
      return {
        ...hud,
        shot: event.release,
        shotsFired: hud.shotsFired + (event.release.kind === 'launch' ? 1 : 0),
      };
    case 'camera-settled':
      return { ...hud, camera: event.camera };
    case 'shot-landed':
      return { ...hud, player: event.player };
  }
}

const formatPoint = ({ x, y }: Vec) => `(${Math.round(x)}, ${Math.round(y)})`;

const CANCEL_LABELS = { 'too-short': 'too short', interrupted: 'interrupted' } as const;

function formatTouch(touch: TouchStart | null): string {
  if (touch === null) return 'Touch: none';
  return `Touch: ${touch.owner} · screen ${formatPoint(touch.screen)} → world ${formatPoint(touch.world)}`;
}

function formatShot(shot: AimRelease | null): string {
  if (shot === null) return 'Shot: none';
  if (shot.kind === 'cancelled') return `Shot: cancelled · ${CANCEL_LABELS[shot.reason]}`;
  const { x, y } = shot.direction;
  return `Shot: launched · power ${Math.round(shot.power * 100)}% · direction (${x.toFixed(2)}, ${y.toFixed(2)})`;
}

export function Playfield() {
  const viewport = useSafeAreaFrame();
  const insets = useSafeAreaInsets();
  const initialCamera = cameraCenteredOn(TUNING.spawn, viewport, TUNING.world);

  const camera = useSharedValue<Camera>(initialCamera);
  const player = useSharedValue<WorldPoint>(TUNING.spawn);
  const sequence = useSharedValue<TouchSequence>(IDLE);
  const shotInFlight = useSharedValue(false);
  const [hud, dispatch] = useReducer(hudReducer, {
    camera: initialCamera,
    player: TUNING.spawn,
    touch: null,
    shot: null,
    shotsFired: 0,
  });

  const pan = usePanGesture({
    minDistance: 0,
    onBegin: (event) => {
      cancelAnimation(camera);
      const screen = screenPoint(event.x, event.y);
      const world = screenToWorld(screen, camera.get());
      const owner = ownerForTouch(world, player.get(), !shotInFlight.get(), TUNING.aim);
      sequence.set(
        owner === 'aim'
          ? { kind: 'aiming', anchor: world, finger: world }
          : { kind: 'panning', startCamera: camera.get() },
      );
      scheduleOnRN(dispatch, { type: 'touch-start', touch: { owner, screen, world } });
    },
    onUpdate: (event) => {
      const current = sequence.get();
      if (current.kind === 'aiming') {
        const finger = screenToWorld(screenPoint(event.x, event.y), camera.get());
        sequence.set({ ...current, finger });
      } else if (current.kind === 'panning') {
        const { startCamera } = current;
        camera.set(
          clampCamera(
            worldPoint(startCamera.x - event.translationX, startCamera.y - event.translationY),
            viewport,
            TUNING.world,
          ),
        );
      }
    },
    onFinalize: (event) => {
      const ended = sequence.get();
      sequence.set(IDLE);
      if (ended.kind === 'panning') {
        scheduleOnRN(dispatch, { type: 'camera-settled', camera: camera.get() });
      } else if (ended.kind === 'aiming') {
        const release = resolveRelease(ended.anchor, ended.finger, event.canceled, TUNING.aim);
        if (release.kind === 'launch') {
          const destination = shotDestination(
            player.get(),
            release,
            TUNING.aim,
            TUNING.world,
            TUNING.playerRadius,
          );
          shotInFlight.set(true);
          player.set(
            withTiming(
              destination,
              { duration: TUNING.shotMs, easing: Easing.out(Easing.cubic) },
              () => {
                shotInFlight.set(false);
                scheduleOnRN(dispatch, { type: 'shot-landed', player: player.get() });
              },
            ),
          );
        }
        scheduleOnRN(dispatch, { type: 'released', release });
      }
    },
  });

  const recenter = () => {
    camera.set(
      withTiming(
        cameraCenteredOn(player.get(), viewport, TUNING.world),
        { duration: TUNING.recenterMs, easing: Easing.inOut(Easing.cubic) },
        () => {
          scheduleOnRN(dispatch, { type: 'camera-settled', camera: camera.get() });
        },
      ),
    );
  };

  const worldTransform = useDerivedValue(() => {
    const { x, y } = camera.get();
    return [{ translateX: -x }, { translateY: -y }];
  });
  const aim = useDerivedValue(() => {
    const current = sequence.get();
    return current.kind === 'aiming'
      ? aimFromPull(current.anchor, current.finger, TUNING.aim)
      : null;
  });
  const arrow = useDerivedValue(() => {
    const current = aim.get();
    return current === null ? '' : arrowPath(player.get(), current);
  });
  const arrowColor = useDerivedValue(() => (aim.get()?.armed ? COLORS.armed : COLORS.unarmed));
  const pullLine = useDerivedValue(() => {
    const current = sequence.get();
    if (current.kind !== 'aiming') return '';
    const { x, y } = player.get();
    return `M ${x} ${y} L ${x + current.finger.x - current.anchor.x} ${y + current.finger.y - current.anchor.y}`;
  });

  const { width, height } = TUNING.world;
  return (
    <View style={styles.root}>
      <GestureDetector gesture={pan}>
        <Canvas style={styles.root}>
          <Group transform={worldTransform}>
            <Rect x={0} y={0} width={width} height={height} color={COLORS.floor} />
            <Path path={GRID_PATH} style="stroke" strokeWidth={1} color={COLORS.grid} />
            {LANDMARKS.map(({ x, y, r }) => (
              <Circle key={`${x},${y}`} cx={x} cy={y} r={r} color={COLORS.landmark} />
            ))}
            <Rect
              x={0}
              y={0}
              width={width}
              height={height}
              style="stroke"
              strokeWidth={6}
              color={COLORS.border}
            />
            <Path
              path={pullLine}
              style="stroke"
              strokeWidth={2}
              strokeCap="round"
              color={COLORS.pull}
            />
            <Circle c={player} r={TUNING.playerRadius} color={COLORS.player} />
            <Circle
              c={player}
              r={TUNING.playerRadius}
              style="stroke"
              strokeWidth={3}
              color={COLORS.playerOutline}
            />
            <Path
              path={arrow}
              style="stroke"
              strokeWidth={5}
              strokeCap="round"
              strokeJoin="round"
              color={arrowColor}
            />
          </Group>
        </Canvas>
      </GestureDetector>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={[styles.hud, { top: insets.top + 8 }]} pointerEvents="none">
          <Text testID="hud-camera" style={styles.hudLine}>
            Camera: {formatPoint(hud.camera)}
          </Text>
          <Text testID="hud-player" style={styles.hudLine}>
            Player: {formatPoint(hud.player)}
          </Text>
          <Text testID="hud-touch" style={styles.hudLine}>
            {formatTouch(hud.touch)}
          </Text>
          <Text testID="hud-shot" style={styles.hudLine}>
            {formatShot(hud.shot)}
          </Text>
          <Text testID="hud-shots" style={styles.hudLine}>
            Shots fired: {hud.shotsFired}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Recenter"
          onPress={recenter}
          style={({ pressed }) => [
            styles.recenter,
            { bottom: insets.bottom + 16, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={styles.recenterLabel}>Recenter</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hud: {
    position: 'absolute',
    left: 12,
    right: 12,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
  },
  hudLine: { fontSize: 13, color: '#1d1b18', fontVariant: ['tabular-nums'] },
  recenter: {
    position: 'absolute',
    right: 16,
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#1d1b18',
  },
  recenterLabel: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
