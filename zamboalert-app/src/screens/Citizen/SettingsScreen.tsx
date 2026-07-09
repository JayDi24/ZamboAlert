// src/screens/SettingsScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import Header from '../../components/Header';
import Card from '../../components/Card';
import { SecondaryButton } from '../../components/Button';
import { useAuth } from '../../context/AuthContext';

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
  isLast?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

type PermissionRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  granted: boolean;
  isLast?: boolean;
};

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [contact, setContact] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [notes, setNotes] = useState('');
  const [autoSos, setAutoSos] = useState(false);

  return (
    <View style={styles.screen}>
      <Header statusLine={null} onSettingsPress={() => {}} />

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
            </View>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{user?.role}</Text>
            </View>
          </View>
        </Card>

        {/* Emergency profile */}
        <Card>
          <Text style={[typography.eyebrow, styles.cardLabel]}>Emergency profile</Text>
          <Field label="Full name" value={name} onChangeText={setName} placeholder="Juan Dela Cruz" autoCapitalize="words" />
          <Field label="Emergency contact" value={contact} onChangeText={setContact} placeholder="Name and phone number" />
          <Field label="Blood type" value={bloodType} onChangeText={setBloodType} placeholder="O+" />
          <Field label="Medical notes" value={notes} onChangeText={setNotes} placeholder="Allergies, conditions, medication" multiline isLast />
        </Card>

        {/* Beacon behavior */}
        <Card>
          <Text style={[typography.eyebrow, styles.cardLabel]}>Beacon behavior</Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={typography.body}>Auto-send SOS on signal loss</Text>
              <Text style={[typography.meta, styles.switchHint]}>
                Starts broadcasting automatically when cellular signal drops out.
              </Text>
            </View>
            <Switch
              value={autoSos}
              onValueChange={setAutoSos}
              trackColor={{ false: colors.inactiveBg, true: colors.primaryLight }}
              thumbColor={autoSos ? colors.primary : '#FFFFFF'}
            />
          </View>
        </Card>

        {/* Security */}
        <SecuritySection />

        {/* Permissions */}
        <Card>
          <Text style={[typography.eyebrow, styles.cardLabel]}>Permissions</Text>
          <PermissionRow icon="bluetooth" label="Bluetooth" granted />
          <PermissionRow icon="location" label="Location" granted isLast />
        </Card>

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

// ── Security card: MFA setup/toggle + session details ─────────────────────
function SecuritySection() {
  const { user, session, updateUser } = useAuth();
  const [showSetup, setShowSetup] = useState(false);
  const [tempSecret, setTempSecret] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [setupError, setSetupError] = useState('');

  if (!user || !session) return null;

  function startMfaSetup() {
    const secret = 'ZB-' + Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase();
    setTempSecret(secret);
    setSetupCode('');
    setSetupError('');
    setShowSetup(true);
  }

  function cancelMfaSetup() {
    setShowSetup(false);
    setSetupCode('');
    setSetupError('');
  }

  function confirmMfaSetup() {
    if (setupCode.trim().length !== 6) {
      setSetupError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    updateUser({ mfaEnabled: true, mfaSecret: tempSecret });
    setShowSetup(false);
    setSetupCode('');
  }

  function disableMfa() {
    updateUser({ mfaEnabled: false, mfaSecret: '' });
  }

  return (
    <Card>
      <View style={styles.securityHeaderRow}>
        <Text style={[typography.eyebrow, styles.cardLabel, { marginBottom: 0 }]}>Security</Text>
        <View style={[styles.mfaBadge, user.mfaEnabled ? styles.mfaBadgeOn : styles.mfaBadgeOff]}>
          <Text style={[styles.mfaBadgeText, { color: user.mfaEnabled ? colors.success : colors.textMuted }]}>
            MFA {user.mfaEnabled ? 'ON' : 'OFF'}
          </Text>
        </View>
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={typography.body}>Multi-factor authentication</Text>
          <Text style={[typography.meta, styles.switchHint]}>
            Require a 6-digit code from an authenticator app each time you sign in.
          </Text>
        </View>
        <Switch
          value={user.mfaEnabled}
          onValueChange={(v) => (v ? startMfaSetup() : disableMfa())}
          trackColor={{ false: colors.inactiveBg, true: colors.primaryLight }}
          thumbColor={user.mfaEnabled ? colors.primary : '#FFFFFF'}
        />
      </View>

      {showSetup && (
        <View style={styles.mfaSetupBox}>
          <Text style={[typography.body, styles.mfaSetupTitle]}>Set up authenticator app</Text>
          <Text style={[typography.meta, styles.mfaSetupStep]}>
            1. Add this key to your authenticator app:
          </Text>
          <View style={styles.secretChip}>
            <Text style={styles.secretChipText}>{tempSecret}</Text>
          </View>
          <Text style={[typography.meta, styles.mfaSetupStep]}>
            2. Enter the 6-digit code it generates:
          </Text>
          <TextInput
            value={setupCode}
            onChangeText={(t) => { setSetupCode(t); if (setupError) setSetupError(''); }}
            placeholder="123456"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            maxLength={6}
            style={styles.mfaInput}
          />
          {setupError ? <Text style={styles.mfaErrorText}>{setupError}</Text> : null}
          <View style={styles.mfaActionRow}>
            <SecondaryButton label="Cancel" onPress={cancelMfaSetup} />
            <View style={{ width: 10 }} />
            <SecondaryButton label="Confirm" icon="checkmark-outline" onPress={confirmMfaSetup} />
          </View>
        </View>
      )}

      <View style={styles.sessionBlock}>
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

function Field({ label, value, onChangeText, placeholder, multiline, isLast, autoCapitalize }: FieldProps) {
  return (
    <View style={[styles.field, !isLast && styles.fieldSpacing]}>
      <Text style={[typography.meta, styles.fieldLabel]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        autoCapitalize={autoCapitalize || 'none'}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

function PermissionRow({ icon, label, granted, isLast }: PermissionRowProps) {
  return (
    <View style={[styles.permRow, !isLast && styles.permRowBorder]}>
      <View style={styles.permLeft}>
        <Ionicons name={icon} size={16} color={colors.textSecondary} />
        <Text style={typography.body}>{label}</Text>
      </View>
      <Text style={[typography.meta, { color: granted ? colors.success : colors.textMuted }]}>
        {granted ? 'Granted' : 'Not granted'}
      </Text>
    </View>
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
  field: {},
  fieldSpacing: { marginBottom: 14 },
  fieldLabel: { marginBottom: 6 },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.textPrimary,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchHint: { marginTop: 2, lineHeight: 16 },
  permRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  permRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  permLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  securityHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  mfaBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  mfaBadgeOn: { backgroundColor: 'rgba(16,185,129,0.12)' },
  mfaBadgeOff: { backgroundColor: colors.inactiveBg },
  mfaBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 11 },

  mfaSetupBox: {
    marginTop: 14,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  mfaSetupTitle: { marginBottom: 6 },
  mfaSetupStep: { marginBottom: 6, lineHeight: 16 },
  secretChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8, paddingVertical: 4,
    marginBottom: 10,
  },
  secretChipText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  mfaInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  mfaErrorText: { fontFamily: 'Inter_400Regular', fontSize: 11.5, color: colors.primary, marginBottom: 8 },
  mfaActionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },

  sessionBlock: { marginTop: 16 },
  sessionToken: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11 },
});
