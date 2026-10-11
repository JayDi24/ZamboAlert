// src/screens/StatusScreen.js
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import Header from '../../components/Header';
import Card from '../../components/Card';
import StatusDot from '../../components/StatusDot';
import { useAppState } from '../../context/AppStateContext';

export default function StatusScreen({ navigation }: any) {
  const { sosActive, coords, gpsLocked } = useAppState();

  return (
    <View style={styles.screen}>
      <Header
        statusLine={sosActive ? 'SOS beacon active' : 'No active SOS beacon'}
        statusDotColor={sosActive ? colors.primary : colors.statusUnknown}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.cardHeaderRow}>
            <Text style={typography.h2}>Last known position</Text>
            <View style={styles.cachedBadge}>
              <View style={styles.cachedDot} />
              <Text style={styles.cachedText}>{gpsLocked ? 'GPS' : 'NO FIX'}</Text>
            </View>
          </View>

          <View style={styles.coordsBox}>
            <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
            <Text style={typography.body}>
              {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'No GPS fix yet'}
            </Text>
          </View>

          <View style={styles.legendRow}>
            <StatusDot color={colors.statusSelf} label="You" />
            <StatusDot color={colors.statusCritical} label="Beacon" />
            <StatusDot color={colors.statusUnknown} label="No fix" />
          </View>
        </Card>

        <Card>
          <Text style={[typography.eyebrow, styles.cardLabel]}>Rescuer pod network</Text>
          <View style={styles.emptyState}>
            <Ionicons name="radio-outline" size={22} color={colors.textMuted} />
            <Text style={[typography.meta, styles.emptyText]}>
              Pod locations and SOS detections are available on the operations dashboard after the gateway receives LoRa telemetry.
            </Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cachedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cachedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  cachedText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.textSecondary, letterSpacing: 0.5 },
  coordsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  legendRow: { flexDirection: 'row', gap: 18, marginTop: 14 },
  cardLabel: { marginBottom: 10 },
  emptyState: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  emptyText: { textAlign: 'center', maxWidth: 240 },
});
