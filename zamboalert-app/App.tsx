// App.tsx
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { colors } from './src/theme/colors';
import { AuthProvider } from './src/context/AuthContext';
import { AppStateProvider } from './src/context/AppStateContext';
import RootNavigator from './src/navigation/RootNavigator';

function AmbientBackground() {
  return (
    <View style={styles.backgroundLayer} pointerEvents="none">
      <View style={[styles.glow, styles.glowOne]} />
      <View style={[styles.glow, styles.glowTwo]} />
      <View style={styles.vignette} />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.appShell}>
        <AuthProvider>
          <AppStateProvider>
            <StatusBar style="dark" />
            <View style={styles.appBackground}>
              <AmbientBackground />
              <View style={styles.contentLayer}>
                <RootNavigator />
              </View>
            </View>
          </AppStateProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  appShell: {
    flex: 1,
  },
  appBackground: {
    flex: 1,
    backgroundColor: '#fff5f5',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 244, 244, 0.88)',
  },
  glow: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
  },
  glowOne: {
    backgroundColor: 'rgba(255, 95, 95, 0.22)',
    left: -80,
    top: -40,
  },
  glowTwo: {
    backgroundColor: 'rgba(255, 145, 145, 0.16)',
    right: -90,
    bottom: 80,
  },
  vignette: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  contentLayer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

