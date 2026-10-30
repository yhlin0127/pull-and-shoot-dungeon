import { render, screen } from '@testing-library/react-native';

import App from '../App';

describe('App', () => {
  it('starts with the camera centered on the spawn and no input yet', async () => {
    await render(<App />);

    // The safe-area mock reports a 320 x 640 window; the spawn is world (600, 1400).
    expect(screen.getByTestId('hud-camera')).toHaveTextContent('Camera: (440, 1080)');
    expect(screen.getByTestId('hud-player')).toHaveTextContent('Player: (600, 1400)');
    expect(screen.getByTestId('hud-touch')).toHaveTextContent('Touch: none');
    expect(screen.getByTestId('hud-shot')).toHaveTextContent('Shot: none');
    expect(screen.getByTestId('hud-shots')).toHaveTextContent('Shots fired: 0');
  });

  it('offers an accessible Recenter button', async () => {
    await render(<App />);

    expect(screen.getByRole('button', { name: 'Recenter' })).toBeOnTheScreen();
  });
});
