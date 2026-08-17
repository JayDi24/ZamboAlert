import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, Animated, Easing, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

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

  const overlayOpacity = contentOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <StatusBar style={animationDone ? 'dark' : 'light'} />
        
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.mainContent, { opacity: contentOpacity }]}>
            {/* Target logo container */}
            <View 
              ref={logoWrapRef} 
              onLayout={handleLogoLayout} 
              style={[styles.logoWrap, { opacity: animationDone ? 1 : 0 }]} 
            >
              {animationDone && (
                <Image source={require('../../assets/zamboalert.png')} style={styles.logoImage} />
              )}
            </View>

            {/* Google-style Text Presentation */}
            <View style={styles.headerTextContainer}>
              <Text style={styles.eyebrow}>Offline Emergency Network</Text>
              <Text style={styles.appName}>ZamboAlert</Text>
              <Text style={styles.tagline}>
                Decentralized emergency communication for Zamboanga City. Keep in touch with responders even when all networks and internet are completely down.
              </Text>
            </View>

            {/* Google-style Cards */}
            <View style={styles.featuresContainer}>
              <FeatureCard 
                icon="bluetooth-outline" 
                title="Offline BLE Beaconing" 
                description="Broadcasts high-priority emergency distress signals to nearby search & rescue pods."
              />
              <FeatureCard 
                icon="radio-outline" 
                title="LoRa Mesh Routing" 
                description="Bridges messages across active rescuer nodes to extend coverage in crisis zones."
              />
              <FeatureCard 
                icon="navigate-outline" 
                title="GPS Offline Localization" 
                description="Encodes precise geographical coordinates directly into beacon data for rapid response."
              />
            </View>
          </Animated.View>
        </ScrollView>

        {/* Sticky bottom Google-style action buttons */}
        <Animated.View 
          style={[
            styles.bottomContainer, 
            { 
              opacity: contentOpacity,
              transform: [{ translateY: bottomTranslateY }]
            }
          ]}
        >
          <View style={styles.buttonStack}>
            <GooglePrimaryButton label="Sign in" onPress={() => navigation.navigate('Login')} />
            <GoogleSecondaryButton label="Create an account" onPress={() => navigation.navigate('SignUp')} />
          </View>
          <Text style={styles.disclaimer}>
            By continuing, you agree to ZamboAlert's terms of use and privacy policy.
          </Text>
        </Animated.View>
      </SafeAreaView>

      {/* Red splash overlay that fades out during intro transition */}
      {layoutMeasured && !animationDone && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: colors.primary,
              opacity: overlayOpacity,
              zIndex: 5,
            },
          ]}
        />
      )}

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

function FeatureCard({ icon, title, description }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardIconContainer}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>
    </View>
  );
}

function GooglePrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.googlePrimary,
        pressed && styles.googlePrimaryPressed,
      ]}
    >
      <Text style={styles.googlePrimaryLabel}>{label}</Text>
    </Pressable>
  );
}

function GoogleSecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.googleSecondary,
        pressed && styles.googleSecondaryPressed,
      ]}
    >
      <Text style={styles.googleSecondaryLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  safe: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  scrollContainer: {
    flexGrow: 1,
    paddingTop: 36,
    paddingBottom: 20,
  },
  mainContent: {
    alignItems: 'center',
    width: '100%',
  },
  logoWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
  },
  headerTextContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: 6,
    textAlign: 'center',
  },
  appName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    color: colors.textPrimary,
    letterSpacing: -0.8,
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14.5,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresContainer: {
    width: '100%',
    paddingHorizontal: 24,
    marginTop: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 2,
  },
  cardIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14.5,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  cardDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  bottomContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    width: '100%',
  },
  buttonStack: {
    gap: 12,
    marginBottom: 12,
  },
  googlePrimary: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  googlePrimaryPressed: {
    backgroundColor: colors.primaryDark,
  },
  googlePrimaryLabel: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    letterSpacing: 0.1,
  },
  googleSecondary: {
    backgroundColor: 'transparent',
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleSecondaryPressed: {
    backgroundColor: colors.primaryLight,
  },
  googleSecondaryLabel: {
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    letterSpacing: 0.1,
  },
  disclaimer: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
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
