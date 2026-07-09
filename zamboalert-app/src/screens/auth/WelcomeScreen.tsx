import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { PrimaryButton, SecondaryButton } from '../../components/Button';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }) {
  const [targetLayout, setTargetLayout] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [layoutMeasured, setLayoutMeasured] = useState(false);
  const [animationStarted, setAnimationStarted] = useState(false);
  const [animationDone, setAnimationDone] = useState(false);

  const logoWrapRef = useRef<View>(null);

  // Animated values for the transition
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const bottomTranslateY = useRef(new Animated.Value(150)).current; // starts slightly below

  // Animated value for pulsing the logo
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation during loading
  useEffect(() => {
    let pulse: Animated.CompositeAnimation | null = null;
    if (!animationStarted) {
      pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.06,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (pulse) pulse.stop();
    };
  }, [animationStarted]);

  // Handle measurement of the target logo position
  const handleLogoLayout = () => {
    if (targetLayout) return;
    
    // Slight delay to ensure React Native has completed layout rendering
    setTimeout(() => {
      if (logoWrapRef.current) {
        logoWrapRef.current.measureInWindow((x, y, width, height) => {
          if (width > 0 && height > 0) {
            setTargetLayout({ x, y, width, height });
          }
        });
      }
    }, 100);
  };

  // Trigger the transition once targetLayout is measured
  useEffect(() => {
    if (!targetLayout || animationStarted) return;

    // Calculate center coordinates
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;

    // Center of the final logo position
    const finalCenterX = targetLayout.x + targetLayout.width / 2;
    const finalCenterY = targetLayout.y + targetLayout.height / 2;

    // Translation needed to put the logo in the center of the screen
    const startX = centerX - finalCenterX;
    const startY = centerY - finalCenterY;

    // Set initial values
    translateX.setValue(startX);
    translateY.setValue(startY);
    scale.setValue(1.5); // logo size in loading is 1.5x (120px)

    // Mark as measured, switching from temp loading logo to animated final logo
    setLayoutMeasured(true);

    // Keep the loading screen state for 1.2 seconds, then transition
    const timer = setTimeout(() => {
      setAnimationStarted(true);

      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 1000,
          easing: Easing.out(Easing.back(0.8)),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 1000,
          easing: Easing.out(Easing.back(0.8)),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.0,
          duration: 1000,
          easing: Easing.out(Easing.back(0.8)),
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(bottomTranslateY, {
          toValue: 0,
          duration: 1000,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setAnimationDone(true);
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [targetLayout]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.hero}>
          {/* logoWrap contains the reference to measure final location */}
          <View 
            ref={logoWrapRef} 
            onLayout={handleLogoLayout} 
            style={[styles.logoWrap, { opacity: animationDone ? 1 : 0 }]} 
          >
            {/* Render a normal image inside when animation is done, so it's fully responsive */}
            {animationDone && (
              <Image source={require('../../assets/zamboalert.png')} style={styles.logoImage} />
            )}
          </View>

          {/* Main welcome screen contents fade in */}
          <Animated.View style={{ alignItems: 'center', opacity: contentOpacity, width: '100%' }}>
            <Text style={styles.appName}>ZamboAlert</Text>
            <Text style={styles.tagline}>
              Emergency communication for Zamboanga City — even when all signals are gone.
            </Text>
            <View style={styles.pillRow}>
              <Pill icon="bluetooth" label="BLE Beacon" />
              <Pill icon="radio-outline" label="LoRa Mesh" />
              <Pill icon="navigate" label="GPS Offline" />
            </View>
          </Animated.View>
        </View>

        {/* Bottom card slides up and fades in */}
        <Animated.View 
          style={[
            styles.bottom, 
            { 
              opacity: contentOpacity,
              transform: [{ translateY: bottomTranslateY }]
            }
          ]}
        >
          <Text style={styles.bottomHeading}>Get started</Text>
          <Text style={[typography.meta, styles.bottomSub]}>
            Sign in to your account or create a new one to access emergency
            services and stay connected during crises.
          </Text>
          <View style={styles.buttonStack}>
            <PrimaryButton label="Sign in" icon="arrow-forward-outline" onPress={() => navigation.navigate('Login')} />
            <SecondaryButton label="Create an account" onPress={() => navigation.navigate('SignUp')} fullWidth />
          </View>
          <Text style={[typography.meta, styles.disclaimer]}>
            By continuing you agree to ZamboAlert's terms of use and privacy policy.
          </Text>
        </Animated.View>
      </SafeAreaView>

      {/* Animated moving logo overlaid during transition */}
      {layoutMeasured && !animationDone && targetLayout && (
        <Animated.View
          style={[
            styles.logoWrap,
            {
              position: 'absolute',
              left: targetLayout.x,
              top: targetLayout.y,
              width: targetLayout.width,
              height: targetLayout.height,
              transform: [
                { translateX },
                { translateY },
                { scale: animationStarted ? scale : pulseAnim },
              ],
              zIndex: 10,
            },
          ]}
        >
          <Image source={require('../../assets/zamboalert.png')} style={styles.logoImage} />
        </Animated.View>
      )}

      {/* Temporary centered logo displayed before layout measurement */}
      {!layoutMeasured && (
        <View style={styles.loadingContainer}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Image source={require('../../assets/zamboalert.png')} style={styles.loadingLogo} />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

function Pill({ icon, label }) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={13} color="rgba(255,255,255,0.85)" />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  safe: { flex: 1, backgroundColor: colors.primary },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 32,
  },
  logoWrap: {
    width: 80, height: 80,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
  },
  appName: {
    fontFamily: 'Inter_700Bold', fontSize: 34,
    color: colors.textOnPrimary, letterSpacing: -0.5, marginBottom: 10,
  },
  tagline: {
    fontFamily: 'Inter_400Regular', fontSize: 15,
    color: 'rgba(255,255,255,0.80)', textAlign: 'center',
    lineHeight: 22, marginBottom: 24,
  },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  pillText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  bottom: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 10,
  },
  bottomHeading: { fontFamily: 'Inter_700Bold', fontSize: 22, color: colors.textPrimary, marginBottom: 6 },
  bottomSub: { lineHeight: 19, marginBottom: 24 },
  buttonStack: { gap: 12 },
  disclaimer: { textAlign: 'center', marginTop: 16, lineHeight: 17, fontSize: 11 },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  loadingLogo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
});
