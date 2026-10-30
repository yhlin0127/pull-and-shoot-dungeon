import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

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

describe('App', () => {
  it('starts with the camera on the spawn and the first-floor readout', async () => {
    await render(<App />);

    expectInitialHud();
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
});
