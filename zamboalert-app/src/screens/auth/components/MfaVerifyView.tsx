import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { PrimaryButton } from '../../../components/Button';
import {
  InputField,
  ErrorBox,
  BackLink,
  AuthCardWrapper,
} from './AuthComponents';

interface MfaVerifyViewProps {
  error: string;
  loading: boolean;
  onVerify: (code: string) => Promise<boolean>;
  onCancel: () => void;
}

export function MfaVerifyView({
  error,
  loading,
  onVerify,
  onCancel,
}: MfaVerifyViewProps) {
  const [mfaCode, setMfaCode] = useState('');

  async function handleVerifyMfa() {
    const cleanCode = mfaCode.trim();
    if (cleanCode.length !== 6) return;
    const ok = await onVerify(cleanCode);
    if (ok) setMfaCode('');
  }

  return (
    <AuthCardWrapper>
      <View style={styles.iconHeroWrap}>
        <View style={[styles.iconHeroCircle, { backgroundColor: 'rgba(34, 197, 94, 0.12)' }]}>
          <Ionicons name="shield-checkmark" size={32} color={colors.success} />
        </View>
      </View>

      <Text style={styles.heading}>Two-Factor Security</Text>
      <Text style={styles.sub}>
        Enter the 6-digit security code from your authenticator app to complete sign in.
      </Text>

      <InputField
        label="Authentication Code"
        icon="shield-checkmark-outline"
        placeholder="6-digit authenticator code"
        value={mfaCode}
        onChangeText={setMfaCode}
        keyboardType="numeric"
        maxLength={6}
      />

      {error ? <ErrorBox message={error} /> : null}

      <View style={styles.submitRow}>
        <PrimaryButton
          label="Verify and Sign In"
          icon="log-in-outline"
          onPress={handleVerifyMfa}
          disabled={mfaCode.length !== 6}
          loading={loading}
        />
      </View>

      <BackLink label="Cancel and Sign Out" onPress={onCancel} />
    </AuthCardWrapper>
  );
}

const styles = StyleSheet.create({
  iconHeroWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconHeroCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  sub: {
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  submitRow: {
    marginVertical: 14,
  },
});
