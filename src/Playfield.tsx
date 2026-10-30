import { Canvas, Circle, Group, Path, Rect } from '@shopify/react-native-skia';
import { useReducer, useState } from 'react';
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
import { createGame } from './game/model';
import { FIRST_FLOOR } from './game/firstFloor';
import { PLACEHOLDER_TUNING } from './game/placeholder';

const TUNING = {
  aim: { touchRadius: 44, minPull: 12, maxPull: 120 },
  shotMs: 600,
  recenterMs: 400,
  arrowLengthAtFullPower: 140,
  arrowHead: 14,
  gridSpacing: 100,
};

const AIM = {
  ...TUNING.aim,
  maxShotDistance: PLACEHOLDER_TUNING.launch.maxDistance,
};

const COLORS = {
  floor: '#ece7dc',
  grid: '#d3ccbd',
  border: '#4a453d',
  objective: 'rgba(47, 125, 82, 0.35)',
  objectiveStroke: '#1f6b45',
  spawn: '#6b645c',
  wall: '#5c564c',
  enemy: '#c92a2a',
  enemyOutline: '#5c1010',
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

function arrowPath(player: WorldPoint, aim: Aim, radius: number): string {
  'worklet';
  const { x: dx, y: dy } = aim.direction;
  const tailX = player.x + dx * radius;
  const tailY = player.y + dy * radius;
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

function formatStats(radius: number, health: number, maxHealth: number, damage: number): string {
  return `radius ${radius} · health ${health}/${maxHealth} · damage ${damage}`;
}

export function Playfield({ onRestart }: { onRestart: () => void }) {
  const [game] = useState(() => createGame(FIRST_FLOOR));
  const world = game.floor.bounds;
  const playerRadius = game.player.radius;
  const viewport = useSafeAreaFrame();
  const insets = useSafeAreaInsets();
  const initialCamera = cameraCenteredOn(game.player.position, viewport, world);

  const camera = useSharedValue<Camera>(initialCamera);
  const player = useSharedValue<WorldPoint>(game.player.position);
  const sequence = useSharedValue<TouchSequence>(IDLE);
  const shotInFlight = useSharedValue(false);
  const [hud, dispatch] = useReducer(hudReducer, {
    camera: initialCamera,
    player: game.player.position,
    touch: null,
    shot: null,
    shotsFired: 0,
  });

  const pan = usePanGesture({
    testID: 'playfield-pan',
    minDistance: 0,
    maxPointers: 1,
    onBegin: (event) => {
      cancelAnimation(camera);
      const screen = screenPoint(event.x, event.y);
      const cameraAtTouch = camera.get();
      const worldPointAtTouch = screenToWorld(screen, cameraAtTouch);
      const owner = ownerForTouch(worldPointAtTouch, player.get(), !shotInFlight.get(), AIM);
      sequence.set(
        owner === 'aim'
          ? { kind: 'aiming', anchor: screen, finger: screen }
          : { kind: 'panning', startCamera: cameraAtTouch },
      );
      scheduleOnRN(dispatch, {
        type: 'touch-start',
        touch: { owner, screen, world: worldPointAtTouch },
      });
    },
    onUpdate: (event) => {
      const current = sequence.get();
      if (current.kind === 'aiming') {
        sequence.set({ ...current, finger: screenPoint(event.x, event.y) });
      } else if (current.kind === 'panning') {
        const { startCamera } = current;
        camera.set(
          clampCamera(
            worldPoint(startCamera.x - event.translationX, startCamera.y - event.translationY),
            viewport,
            world,
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
        const release = resolveRelease(ended, event.canceled, AIM);
        if (release.kind === 'launch') {
          const destination = shotDestination(
            player.get(),
            release,
            AIM,
            world,
            playerRadius,
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
        cameraCenteredOn(player.get(), viewport, world),
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
    return current.kind === 'aiming' ? aimFromPull(current, AIM) : null;
  });
  const arrow = useDerivedValue(() => {
    const current = aim.get();
    return current === null ? '' : arrowPath(player.get(), current, playerRadius);
  });
  const arrowColor = useDerivedValue(() => (aim.get()?.armed ? COLORS.armed : COLORS.unarmed));
  const pullLine = useDerivedValue(() => {
    const current = aim.get();
    if (current === null) return '';
    const { x, y } = player.get();
    return `M ${x} ${y} L ${x + current.pull.x} ${y + current.pull.y}`;
  });

  const { width, height } = world;
  const { objective, spawn, walls } = game.floor;
  const grid = gridPath(world, TUNING.gridSpacing);
  return (
    <View style={styles.root}>
      <GestureDetector gesture={pan}>
        <Canvas style={styles.root}>
          <Group transform={worldTransform}>
            <Rect x={0} y={0} width={width} height={height} color={COLORS.floor} />
            <Path path={grid} style="stroke" strokeWidth={1} color={COLORS.grid} />
            <Rect
              x={objective.x}
              y={objective.y}
              width={objective.width}
              height={objective.height}
              color={COLORS.objective}
            />
            <Rect
              x={objective.x}
              y={objective.y}
              width={objective.width}
              height={objective.height}
              style="stroke"
              strokeWidth={3}
              color={COLORS.objectiveStroke}
            />
            <Circle
              cx={spawn.x}
              cy={spawn.y}
              r={playerRadius}
              style="stroke"
              strokeWidth={2}
              color={COLORS.spawn}
            />
            {walls.map((wall, index) => (
              <Rect
                key={index}
                x={wall.x}
                y={wall.y}
                width={wall.width}
                height={wall.height}
                color={COLORS.wall}
              />
            ))}
            {game.enemies.map((enemy) => (
              <Group key={enemy.id}>
                <Circle
                  cx={enemy.position.x}
                  cy={enemy.position.y}
                  r={enemy.radius}
                  color={COLORS.enemy}
                />
                <Circle
                  cx={enemy.position.x}
                  cy={enemy.position.y}
                  r={enemy.radius}
                  style="stroke"
                  strokeWidth={3}
                  color={COLORS.enemyOutline}
                />
              </Group>
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
            <Circle c={player} r={playerRadius} color={COLORS.player} />
            <Circle
              c={player}
              r={playerRadius}
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
          <Text testID="hud-turn" style={styles.hudLine}>
            {`Turn: ${game.turn} · ${game.phase.kind}`}
          </Text>
          <Text testID="hud-floor" style={styles.hudLine}>
            {`Floor: ${width} x ${height} · ${walls.length} walls · spawn ${formatPoint(spawn)}`}
          </Text>
          <Text testID="hud-objective" style={styles.hudLine}>
            {`Objective: ${formatPoint(objective)} ${objective.width} x ${objective.height}`}
          </Text>
          <Text testID="hud-player-stats" style={styles.hudLine}>
            {`Player stats: ${formatStats(game.player.radius, game.player.health, game.player.maxHealth, game.player.damage)}`}
          </Text>
          {game.enemies.map((enemy) => (
            <Text key={enemy.id} testID={`hud-enemy-${enemy.id}`} style={styles.hudLine}>
              {`Enemy ${enemy.id}: ${formatPoint(enemy.position)} · ${formatStats(enemy.radius, enemy.health, enemy.maxHealth, enemy.damage)}`}
            </Text>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restart"
          onPress={onRestart}
          style={({ pressed }) => [
            styles.restart,
            { bottom: insets.bottom + 16, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={styles.cornerLabel}>Restart</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Recenter"
          onPress={recenter}
          style={({ pressed }) => [
            styles.recenter,
            { bottom: insets.bottom + 16, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={styles.cornerLabel}>Recenter</Text>
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
  hudLine: { fontSize: 12, color: '#1d1b18', fontVariant: ['tabular-nums'] },
  restart: {
    position: 'absolute',
    left: 16,
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#1d1b18',
  },
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
  cornerLabel: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
