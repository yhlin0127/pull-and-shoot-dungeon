import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { Playfield } from './src/Playfield';

export default function App() {
  const [attempt, setAttempt] = useState(0);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <GestureHandlerRootView style={styles.root}>
        {/* The remount is a minimal restart so a device check can show that restart recreates the layout and stats, until P1-07 builds the real restart flow. */}
        <Playfield key={attempt} onRestart={() => setAttempt((n) => n + 1)} />
        <StatusBar style="auto" />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
