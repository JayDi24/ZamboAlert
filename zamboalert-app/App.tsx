// App.js
import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Animated, StyleSheet } from 'react-native';
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

function MovingRedGradientBackground() {
  const driftX1 = useRef(new Animated.Value(-30)).current;
  const driftY1 = useRef(new Animated.Value(-40)).current;
  const driftX2 = useRef(new Animated.Value(80)).current;
  const driftY2 = useRef(new Animated.Value(50)).current;
  const glowOpacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(driftX1, { toValue: 75, duration: 9000, useNativeDriver: true }),
          Animated.timing(driftX1, { toValue: -30, duration: 9000, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(driftY1, { toValue: 30, duration: 8000, useNativeDriver: true }),
          Animated.timing(driftY1, { toValue: -40, duration: 8000, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(driftX2, { toValue: -25, duration: 11000, useNativeDriver: true }),
          Animated.timing(driftX2, { toValue: 90, duration: 11000, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(driftY2, { toValue: 70, duration: 10000, useNativeDriver: true }),
          Animated.timing(driftY2, { toValue: -10, duration: 10000, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 0.95, duration: 3000, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.65, duration: 3000, useNativeDriver: true }),
        ]),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [driftX1, driftX2, driftY1, driftY2, glowOpacity]);

  return (
    <Animated.View style={styles.backgroundLayer} pointerEvents="none">
      <Animated.View
        style={[
          styles.glow,
          styles.glowOne,
          {
            opacity: glowOpacity,
            transform: [{ translateX: driftX1 }, { translateY: driftY1 }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.glow,
          styles.glowTwo,
          {
            opacity: glowOpacity,
            transform: [{ translateX: driftX2 }, { translateY: driftY2 }],
          },
        ]}
      />
      <View style={styles.vignette} />
    </Animated.View>
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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
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
              <MovingRedGradientBackground />
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
    backgroundColor: 'rgba(255, 95, 95, 0.30)',
    left: -80,
    top: -40,
  },
  glowTwo: {
    backgroundColor: 'rgba(255, 145, 145, 0.22)',
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
