# Pull and Shoot Dungeon

A turn-based, top-down dungeon game for mobile. Pull the character back and release to launch it across the floor, damaging monsters along the path. Built with Expo and React Native.

The game design, roadmap, and technical design are in [`docs/`](docs/GAME-PLAN.md). Start with `docs/GAME-PLAN.md`.

## Requirements

- Node.js 24 (see `.node-version`). With [fnm](https://github.com/Schniz/fnm), run `fnm install` in this folder.
- Xcode, for the iOS Simulator. If `xcode-select -p` prints `/Library/Developer/CommandLineTools`, run this once:
  `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`

## Getting started

Install dependencies and open the iOS development build:

```sh
npm install
npm run ios
```

`npm run ios` compiles the native app and installs it on the booted iOS Simulator.

The QR code printed by that command uses the `exp+pull-and-shoot-dungeon` scheme. Only the development build handles that scheme. The build is installed on the simulator, so a phone camera cannot open the code.

App Store Expo Go does not run SDK 58 yet. The [Expo SDK 58 release](https://expo.dev/changelog/sdk-58) (15 October 2026) says the store Expo Go for SDK 58 comes later, and a development build is how to run the project until then.

To install the experiment on a physical iPhone, connect the phone and run:

```sh
npm run ios -- --device
```

Xcode asks you to sign the app with your Apple ID the first time.

Skia, Gesture Handler, Reanimated, and Worklets in this repo match the SDK 58 versions in `node_modules/expo/bundledNativeModules.json`.

A pull shorter than `minPull` cancels the shot. `minPull` is 12 points in `src/Playfield.tsx`. This experiment has no cancel area.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start Metro for an installed development build |
| `npm run ios` | Compile the iOS development build and open the simulator. Add `-- --device` to install on a connected iPhone. |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run lint` | ESLint via Expo CLI |
| `npm test` | Jest tests (`jest-expo` preset, React Native Testing Library) |
| `npm run doctor` | `expo-doctor` dependency and config check |

## Stack versions

Versions below are the ones installed in `package-lock.json` for the device experiment.

| Package | Version |
| --- | --- |
| Expo SDK | 58 (`expo` 58.0.21) |
| React Native | 0.88.0 |
| React | 19.3.0 |
| TypeScript | 6.0.3 |
| Jest | 30.5.2 |
| `jest-expo` | 58.0.13 |
| `@testing-library/react-native` | 14.1.0 |
| `test-renderer` | 1.3.1 |
| ESLint | 9.39.5 |
| `eslint-config-expo` | 58.0.4 |
| `@shopify/react-native-skia` | 2.14.0 |
| `react-native-gesture-handler` | 3.3.0 |
| `react-native-reanimated` | 4.7.1 |
| `react-native-worklets` | 0.13.0 |
| `react-native-safe-area-context` | 5.10.1 |
| `expo-dev-client` | 58.0.17 |
| `expo-status-bar` | 58.0.4 |

## Known issues

- `npm audit` reports 3 high-severity findings, all from `zod` below 4.6.6 inside `@expo/cli` (a dev-time tool, not shipped in the app). The suggested `npm audit fix --force` would downgrade Expo to SDK 54, so it is not applied. Revisit when Expo ships a fixed CLI.
- The iPhone 17 simulator ran the drawing, aim, pan, and recenter experiment. A physical iPhone check is still open. App Store Expo Go cannot load this SDK 58 project, so that check needs `npm run ios -- --device` with the phone connected. A clean copy (no `node_modules`) passes `npm ci`, typecheck, lint, and tests.
