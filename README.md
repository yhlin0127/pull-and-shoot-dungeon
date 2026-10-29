# Pull and Shoot Dungeon

A turn-based, top-down dungeon game for mobile. Pull the character back and release to launch it across the floor, damaging monsters along the path. Built with Expo and React Native.

The game design, roadmap, and technical design are in [`docs/`](docs/GAME-PLAN.md). Start with `docs/GAME-PLAN.md`.

## Requirements

- Node.js 24 (see `.node-version`). With [fnm](https://github.com/Schniz/fnm), run `fnm install` in this folder.
- Xcode, for the iOS Simulator. If `xcode-select -p` prints `/Library/Developer/CommandLineTools`, run this once:
  `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`

## Getting started

```sh
npm install
npm start        # Expo dev server; press i to open the iOS Simulator
```

The first run installs Expo Go into the simulator. Expo Go is only for early checks; later phases need a development build once native dependencies are added (see `docs/TECHNICAL-DESIGN.md`).

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run ios` | Start the dev server and open the iOS Simulator |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run lint` | ESLint via Expo CLI |
| `npm test` | Jest tests (`jest-expo` preset, React Native Testing Library) |
| `npm run doctor` | `expo-doctor` dependency and config check |

## Stack versions (recorded in P0-02)

| Package | Version |
| --- | --- |
| Expo SDK | 58 (`expo` 58.0.19) |
| React Native / React | 0.88.0 / 19.3.0 |
| TypeScript | 6.0.3 |
| Jest / `jest-expo` | 30.5.2 / 58.0.12 |
| `@testing-library/react-native` | 14.1.0 (with `test-renderer` 1.3.1) |
| ESLint / `eslint-config-expo` | 9.39.5 / 58.0.4 |

Skia, Gesture Handler, and Reanimated are not installed yet. They are added in P0-03 with `npx expo install` so their versions match the SDK.

## Known issues

- `npm audit` reports 3 high-severity findings, all from `zod` below 4.6.6 inside `@expo/cli` (a dev-time tool, not shipped in the app). The suggested `npm audit fix --force` would downgrade Expo to SDK 54, so it is not applied. Revisit when Expo ships a fixed CLI.
- Not yet verified on a physical device. A clean copy (no `node_modules`) passes `npm ci`, typecheck, lint, and tests.
