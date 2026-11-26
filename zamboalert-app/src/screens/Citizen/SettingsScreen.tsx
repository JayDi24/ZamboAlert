// src/screens/SettingsScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import Header from '../../components/Header';
import Card from '../../components/Card';
import { SecondaryButton } from '../../components/Button';
import { useAuth } from '../../context/AuthContext';

export default function SettingsScreen({ navigation }: any) {
  const { user, logout } = useAuth();

  return (
    <View style={styles.screen}>
      <Header statusLine={null} />

      <ScrollView contentContainerStyle={styles.content}>

        {/* Logged-in user card */}
        <Card style={styles.userCard}>
          <View style={styles.userRow}>
            <View style={styles.avatarWrap}>
              <Ionicons name="person" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.entryTitle}>{user?.name}</Text>
              <Text style={typography.meta}>{user?.email}</Text>
              {user?.contactNumber ? <Text style={typography.meta}>{user?.contactNumber}</Text> : null}
            </View>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{user?.role}</Text>
            </View>
          </View>
        </Card>

        {/* Security */}
        <SecuritySection />

        {/* About */}
        <Card>
          <View style={styles.aboutRow}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={typography.meta}>ZamboAlert Citizen · v1.0.0</Text>
          </View>
        </Card>

        {/* Logout */}
        <SecondaryButton
          label="Log out"
          icon="log-out-outline"
          onPress={logout}
          fullWidth
        />

      </ScrollView>
    </View>
  );
}

// ── Security card: session details ─────────────────────────────────────────
function SecuritySection() {
  const { user, session } = useAuth();

  if (!user || !session) return null;

  return (
    <Card>
      <View>
        <Text style={[typography.eyebrow, styles.cardLabel]}>Current session</Text>
        <View style={styles.permRow}>
          <Text style={[typography.meta]}>Device</Text>
          <Text style={typography.meta}>{session.deviceInfo}</Text>
        </View>
        <View style={styles.permRow}>
          <Text style={[typography.meta]}>IP address</Text>
          <Text style={typography.meta}>{session.ipAddress}</Text>
        </View>
        <View style={[styles.permRow, { borderBottomWidth: 0 }]}>
          <Text style={[typography.meta]}>Session token</Text>
          <Text style={[typography.meta, styles.sessionToken]}>
            {session.token.slice(0, 8)}...{session.token.slice(-6)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 32 },

  userCard: { padding: 14 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  roleBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: { color: colors.textOnPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  cardLabel: { marginBottom: 12 },
  permRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  sessionToken: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11 },
});
