// src/screens/SOSScreen.tsx
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, Animated, Dimensions, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import Header from '../../components/Header';
import AlertBanner from '../../components/AlertBanner';
import Card from '../../components/Card';
import { useAppState } from '../../context/AppStateContext';

// ─── Types ──────────────────────────────────────────────────────────────────
type Disaster = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
};

type DisasterCardProps = {
  disaster: Disaster;
  active: boolean;
  dimmed: boolean;
  onPress: () => void;
};

type StatusRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  ok: boolean;
  isLast?: boolean;
};

// ─── Disaster types ─────────────────────────────────────────────────────────
const DISASTERS: Disaster[] = [
  {
    id: 'earthquake',
    label: 'Earthquake',
    icon: 'earth-outline',
    color: '#C0792A',
    bg: 'rgba(192,121,42,0.12)',
  },
  {
    id: 'flood',
    label: 'Flash Flood',
    icon: 'water-outline',
    color: '#2F6FED',
    bg: 'rgba(47,111,237,0.12)',
  },
  {
    id: 'landslide',
    label: 'Landslide',
    icon: 'layers-outline',
    color: '#7C5C2E',
    bg: 'rgba(124,92,46,0.12)',
  },
  {
    id: 'fire',
    label: 'Fire',
    icon: 'flame-outline',
    color: '#E0342B',
    bg: 'rgba(224,52,43,0.12)',
  },
];

// ─── Screen ─────────────────────────────────────────────────────────────────
export default function SOSScreen({ navigation }) {
  const {
    sosActive, disasterType,
    bluetoothOn, gpsLocked, nearbyPods,
    startBeacon, stopBeacon,
  } = useAppState();
  const [photoProofUri, setPhotoProofUri] = React.useState<string | null>(null);
  const [pendingDisaster, setPendingDisaster] = React.useState<Disaster | null>(null);

  const activeDisaster = DISASTERS.find((d) => d.id === disasterType);

  const statusLine = sosActive
    ? `Broadcasting · ${nearbyPods.length} pod${nearbyPods.length === 1 ? '' : 's'} in range`
    : 'Tap your emergency to send SOS instantly';

  async function capturePhotoProof() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return null;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return result.assets[0].uri;
  }

  async function handleTap(disaster: Disaster) {
    if (sosActive) {
      if (disasterType === disaster.id) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        setPhotoProofUri(null);
        setPendingDisaster(null);
        stopBeacon();
      }
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPendingDisaster(disaster);
  }

  async function handleSendPhoto() {
    if (!pendingDisaster) return;

    const proofUri = await capturePhotoProof();
    if (proofUri) setPhotoProofUri(proofUri);
    else setPhotoProofUri(null);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    startBeacon(pendingDisaster.id);
    setPendingDisaster(null);
  }

  function handleSendWithoutPhoto() {
    if (!pendingDisaster) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    startBeacon(pendingDisaster.id);
    setPendingDisaster(null);
  }

  function handleCancelSOS() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPendingDisaster(null);
  }

  return (
    <View style={styles.screen}>
      <Header
        statusLine={statusLine}
        statusDotColor={sosActive ? colors.primary : colors.statusUnknown}
      />

      {sosActive && activeDisaster && (
        <AlertBanner
          message={`SOS ACTIVE — ${activeDisaster.label.toUpperCase()} EMERGENCY`}
          onPress={() => {}}
        />
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Heading ──────────────────────────────────────────────────── */}
        <View style={styles.heading}>
          <Text style={styles.headingTitle}>
            {sosActive ? 'SOS Beacon Live' : 'What is your emergency?'}
          </Text>
          <Text style={[typography.meta, styles.headingSub]}>
            {sosActive
              ? 'Your beacon is broadcasting. Stay where you are if it\'s safe.'
              : 'Tap once to immediately broadcast your SOS. No confirmation needed.'}
          </Text>
        </View>

        {/* ── Disaster grid ─────────────────────────────────────────────── */}
        <View style={styles.grid}>
          {DISASTERS.map((d) => {
            const isActive = sosActive && disasterType === d.id;
            const isOther  = sosActive && disasterType !== d.id;
            return (
              <DisasterCard
                key={d.id}
                disaster={d}
                active={isActive}
                dimmed={isOther}
                onPress={() => handleTap(d)}
              />
            );
          })}
        </View>

        <Modal
          visible={Boolean(pendingDisaster) && !sosActive}
          transparent
          animationType="fade"
          onRequestClose={handleCancelSOS}
        >
          <Pressable style={styles.modalOverlay} onPress={handleCancelSOS}>
            <Pressable style={styles.actionPanel} onPress={() => {}}>
              <Text style={styles.actionTitle}>{pendingDisaster?.label || 'Emergency'} emergency</Text>
              <Pressable onPress={handleSendPhoto} style={styles.primaryAction}>
                <Ionicons name="camera-outline" size={18} color={colors.textOnPrimary} />
                <Text style={styles.primaryActionText}>Send a photo</Text>
              </Pressable>
              <Pressable onPress={handleSendWithoutPhoto} style={styles.secondaryAction}>
                <Ionicons name="send-outline" size={18} color={colors.textPrimary} />
                <Text style={styles.secondaryActionText}>Send without photo</Text>
              </Pressable>
              <Pressable onPress={handleCancelSOS} style={styles.cancelAction}>
                <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.cancelActionText}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {photoProofUri && sosActive && (
          <Card style={styles.proofCard}>
            <Text style={[typography.eyebrow, { marginBottom: 8 }]}>Photo proof</Text>
            <Image source={{ uri: photoProofUri }} style={styles.proofImage} />
            <Text style={[typography.meta, { marginTop: 8 }]}>Emergency photo attached to current distress signal.</Text>
          </Card>
        )}

        {/* ── Device status ─────────────────────────────────────────────── */}
        <Card style={styles.statusCard}>
          <Text style={[typography.eyebrow, { marginBottom: 10 }]}>Device status</Text>
          <StatusRow icon="bluetooth"     label="Bluetooth"     value={bluetoothOn ? 'On' : 'Off'} ok={bluetoothOn} />
          <StatusRow icon="navigate"      label="GPS lock"      value={gpsLocked ? 'Locked' : 'Searching…'} ok={gpsLocked} />
          <StatusRow icon="radio-outline" label="Pods in range" value={String(nearbyPods.length)} ok={nearbyPods.length > 0} isLast />
        </Card>
      </ScrollView>
    </View>
  );
}

// ─── Disaster card ──────────────────────────────────────────────────────────
function DisasterCard({ disaster, active, dimmed, onPress }: DisasterCardProps) {
  const pulseScale = React.useRef(new Animated.Value(1)).current;
  const pulseOpacity = React.useRef(new Animated.Value(0.25)).current;

  React.useEffect(() => {
    if (!active) {
      pulseScale.setValue(1);
      pulseOpacity.setValue(0.25);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: 1.2, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.1, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        ]),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [active, pulseOpacity, pulseScale]);

  return (
    <Pressable
      onPress={onPress}
      disabled={dimmed}
      style={({ pressed }) => [
        cardStyles.card,
        { backgroundColor: active ? disaster.color : disaster.bg },
        active  && cardStyles.activeElevation,
        dimmed  && cardStyles.dimmed,
        pressed && !dimmed && cardStyles.pressed,
      ]}
    >
      {/* Live pulse ring when active */}
      {active && (
        <Animated.View
          pointerEvents="none"
          style={[
            cardStyles.pulse,
            {
              borderColor: disaster.color,
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
            },
          ]}
        />
      )}

      <Ionicons
        name={disaster.icon}
        size={36}
        color={active ? '#fff' : disaster.color}
      />
      <Text style={[cardStyles.label, active && cardStyles.labelActive]}>
        {disaster.label}
      </Text>

      {active && (
        <View style={cardStyles.liveBadge}>
          <Text style={cardStyles.liveBadgeText}>LIVE</Text>
        </View>
      )}
    </Pressable>
  );
}

const screenWidth = Dimensions.get('window').width;

const cardStyles = StyleSheet.create({
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 140,
    maxWidth: 220,
    aspectRatio: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
    paddingHorizontal: 10,
  },
  activeElevation: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  dimmed: { opacity: 0.3 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  label: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    textAlign: 'center',
    width: '100%',
  },
  labelActive: { color: '#fff' },
  liveBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: '#fff',
    letterSpacing: 0.8,
  },
  pulse: {
    position: 'absolute',
    width: '120%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
  },
});

// ─── Status row ──────────────────────────────────────────────────────────────
function StatusRow({ icon, label, value, ok, isLast }: StatusRowProps) {
  return (
    <View style={[styles.statusRow, !isLast && styles.statusRowBorder]}>
      <View style={styles.statusLeft}>
        <Ionicons name={icon} size={16} color={colors.textSecondary} />
        <Text style={typography.body}>{label}</Text>
      </View>
      <Text style={[typography.body, {
        color: ok ? colors.success : colors.textMuted,
        fontFamily: 'Inter_600SemiBold',
      }]}>
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32, gap: 16 },

  heading: { gap: 4 },
  headingTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
  },
  headingSub: { lineHeight: 19 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  actionPanel: {
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 10,
  },
  actionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: colors.textPrimary,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FDECEC',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F5C5C5',
    width: '100%',
  },
  secondaryActionText: {
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  cancelAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
  },
  cancelActionText: {
    color: colors.textSecondary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  proofCard: {
    gap: 8,
  },
  proofImage: {
    width: '100%',
    height: Math.min(screenWidth * 0.5, 220),
    borderRadius: 12,
    backgroundColor: colors.inactiveBg,
  },

  statusCard: {},
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    flexWrap: 'wrap',
    gap: 6,
  },
  statusRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, maxWidth: '65%' },
});