import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import {
  createGestureController,
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';

import App from '../App';

const INITIAL_HUD = [
  ['hud-camera', 'Camera: (520, 1040)'],
  ['hud-player', 'Player: (680, 1560)'],
  ['hud-touch', 'Touch: none'],
  ['hud-shot', 'Shot: none'],
  ['hud-shots', 'Shots fired: 0'],
  ['hud-turn', 'Turn: 1 · ready'],
  ['hud-floor', 'Floor: 960 x 1680 · 7 walls · spawn (680, 1560)'],
  ['hud-objective', 'Objective: (40, 40) 160 x 160'],
  ['hud-player-stats', 'Player stats: radius 18 · health 5/5 · damage 1'],
  ['hud-enemy-e1', 'Enemy e1: (330, 900) · radius 22 · health 2/2 · damage 1'],
  ['hud-enemy-e2', 'Enemy e2: (420, 900) · radius 22 · health 2/2 · damage 1'],
  ['hud-enemy-e3', 'Enemy e3: (510, 900) · radius 22 · health 2/2 · damage 1'],
  ['hud-enemy-e4', 'Enemy e4: (900, 460) · radius 22 · health 2/2 · damage 1'],
  ['hud-enemy-e5', 'Enemy e5: (320, 120) · radius 22 · health 2/2 · damage 1'],
] as const;

function expectInitialHud() {
  for (const [testID, text] of INITIAL_HUD) {
    expect(screen.getByTestId(testID)).toHaveTextContent(text);
  }
}

function expectLines(prefix: string) {
  for (const [testID, text] of INITIAL_HUD) {
    if (testID.startsWith(prefix)) {
      expect(screen.getByTestId(testID)).toHaveTextContent(text);
    }
  }
}

async function flush() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setImmediate(() => resolve());
    });
  });
}

function playfieldPan() {
  return createGestureController('playfield-pan');
}

describe('App', () => {
  it('starts with the camera on the spawn and the first-floor readout', async () => {
    await render(<App />);

    expectInitialHud();
    expect(getByGestureTestId('playfield-pan').config.maxPointers).toBe(1);
  });

  it('offers accessible Recenter and Restart buttons', async () => {
    await render(<App />);

    expect(screen.getByRole('button', { name: 'Recenter' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Restart' })).toBeOnTheScreen();
  });

  it('returns every HUD line to its initial text after the camera moves and Restart', async () => {
    await render(<App />);
    await act(async () => {
      fireGestureHandler(getByGestureTestId('playfield-pan'), [
        { state: State.BEGAN, x: 20, y: 200 },
        { state: State.ACTIVE, x: 20, y: 200, translationX: 0, translationY: 0 },
        { state: State.ACTIVE, x: 0, y: 150, translationX: -20, translationY: 50 },
        { state: State.END, x: 0, y: 150, translationX: -20, translationY: 50 },
      ]);
      await new Promise<void>((resolve) => {
        setImmediate(() => resolve());
      });
    });

    expect(screen.getByTestId('hud-camera')).toHaveTextContent('Camera: (540, 990)');

    await fireEvent.press(screen.getByRole('button', { name: 'Restart' }));

    expectInitialHud();
  });

  it('cancels a touch on the player that never moves', async () => {
    await render(<App />);
    const pan = playfieldPan();

    await act(async () => {
      pan.begin({ x: 160, y: 520 });
      pan.activate({ x: 160, y: 520 });
      pan.end({ x: 160, y: 520 });
    });
    await flush();

    expect(screen.getByTestId('hud-shot')).toHaveTextContent('Shot: cancelled · too short');
    expect(screen.getByTestId('hud-shots')).toHaveTextContent('Shots fired: 0');
    expect(screen.getByTestId('hud-turn')).toHaveTextContent('Turn: 1 · ready');
    expect(screen.getByTestId('hud-player')).toHaveTextContent('Player: (680, 1560)');
    expectLines('hud-enemy-');
  });

  it('cancels an armed pull that the gesture interrupts', async () => {
    await render(<App />);
    const pan = playfieldPan();

    await act(async () => {
      pan.begin({ x: 160, y: 520 });
      pan.activate({ x: 160, y: 520 });
      pan.update({ x: 160, y: 580 });
      pan.cancel({ x: 160, y: 580 });
    });
    await flush();

    expect(screen.getByTestId('hud-shot')).toHaveTextContent('Shot: cancelled · interrupted');
    expect(screen.getByTestId('hud-shots')).toHaveTextContent('Shots fired: 0');
    expect(screen.getByTestId('hud-turn')).toHaveTextContent('Turn: 1 · ready');
    expect(screen.getByTestId('hud-player')).toHaveTextContent('Player: (680, 1560)');
    expectLines('hud-enemy-');
  });

  it('reports a cancelled pull under minPull as too short', async () => {
    await render(<App />);
    const pan = playfieldPan();

    await act(async () => {
      pan.begin({ x: 160, y: 520 });
      pan.activate({ x: 160, y: 520 });
      pan.update({ x: 171, y: 520 });
      pan.cancel({ x: 171, y: 520 });
    });
    await flush();

    expect(screen.getByTestId('hud-shot')).toHaveTextContent('Shot: cancelled · too short');
    expect(screen.getByTestId('hud-shots')).toHaveTextContent('Shots fired: 0');
    expect(screen.getByTestId('hud-turn')).toHaveTextContent('Turn: 1 · ready');
    expect(screen.getByTestId('hud-player')).toHaveTextContent('Player: (680, 1560)');
    expectLines('hud-enemy-');
  });

  it('does not fire when a pan crosses the player', async () => {
    await render(<App />);
    const pan = playfieldPan();

    await act(async () => {
      pan.begin({ x: 20, y: 200 });
      pan.activate({ x: 20, y: 200, translationX: 0, translationY: 0 });
      pan.update({ x: 160, y: 520, translationX: 140, translationY: 320 });
      pan.update({ x: 200, y: 560, translationX: 180, translationY: 360 });
      pan.end({ x: 200, y: 560, translationX: 180, translationY: 360 });
    });
    await flush();

    expect(screen.getByTestId('hud-touch')).toHaveTextContent(
      'Touch: pan · screen (20, 200) → world (540, 1240)',
    );
    expect(screen.getByTestId('hud-shot')).toHaveTextContent('Shot: none');
    expect(screen.getByTestId('hud-shots')).toHaveTextContent('Shots fired: 0');
    expect(screen.getByTestId('hud-player')).toHaveTextContent('Player: (680, 1560)');
    expect(screen.getByTestId('hud-camera')).toHaveTextContent('Camera: (340, 680)');
  });

  it('does not move the camera while aiming', async () => {
    await render(<App />);
    const pan = playfieldPan();

    await act(async () => {
      pan.begin({ x: 160, y: 520 });
      pan.activate({ x: 160, y: 520 });
      pan.update({ x: 300, y: 700 });
      pan.end({ x: 300, y: 700 });
    });
    await flush();

    expect(screen.getByTestId('hud-camera')).toHaveTextContent('Camera: (520, 1040)');
  });

  it('keeps launch power when Recenter moves the camera during a pull', async () => {
    // setImmediate never reaches withTiming's completion callback, so the settled camera line stays unread.
    jest.useFakeTimers();
    try {
      await render(<App />);
      const pan = playfieldPan();

      await act(async () => {
        pan.begin({ x: 20, y: 200 });
        pan.activate({ x: 20, y: 200, translationX: 0, translationY: 0 });
        pan.update({ x: 0, y: 150, translationX: -20, translationY: 50 });
        pan.end({ x: 0, y: 150, translationX: -20, translationY: 50 });
        jest.advanceTimersByTime(0);
      });

      expect(screen.getByTestId('hud-camera')).toHaveTextContent('Camera: (540, 990)');

      await act(async () => {
        pan.begin({ x: 140, y: 570 });
        pan.activate({ x: 140, y: 570 });
        pan.update({ x: 140, y: 630 });
      });

      await fireEvent.press(screen.getByRole('button', { name: 'Recenter' }));
      await act(async () => {
        jest.advanceTimersByTime(400);
      });

      expect(screen.getByTestId('hud-camera')).toHaveTextContent('Camera: (520, 1040)');

      await act(async () => {
        pan.update({ x: 140, y: 630 });
        pan.end({ x: 140, y: 630 });
        jest.advanceTimersByTime(0);
      });

      expect(screen.getByTestId('hud-shot')).toHaveTextContent(
        'Shot: launched · power 50% · direction (0.00, -1.00)',
      );
      expect(screen.getByTestId('hud-shots')).toHaveTextContent('Shots fired: 1');

      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      expect(screen.getByTestId('hud-player')).toHaveTextContent('Player: (680, 1380)');
      expect(screen.getByTestId('hud-turn')).toHaveTextContent('Turn: 1 · ready');
      expectLines('hud-enemy-');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
