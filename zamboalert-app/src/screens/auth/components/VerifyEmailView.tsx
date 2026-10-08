import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { PrimaryButton } from '../../../components/Button';
import {
  InputField,
  ErrorBox,
  DevCodeHint,
  BackLink,
  AuthCardWrapper,
} from './AuthComponents';

interface VerifyEmailViewProps {
  pendingEmail: string;
  devCode: string | null;
  error: string;
  loading: boolean;
  onVerify: (code: string) => Promise<boolean>;
  onResendCode: () => Promise<boolean>;
  onCancel: () => void;
}

export function VerifyEmailView({
  pendingEmail,
  devCode,
  error,
  loading,
  onVerify,
  onResendCode,
  onCancel,
}: VerifyEmailViewProps) {
  const [verifyCode, setVerifyCode] = useState('');
  const [resendMessage, setResendMessage] = useState('');

  async function handleVerify() {
    const cleanCode = verifyCode.trim();
    if (cleanCode.length !== 6) return;
    const ok = await onVerify(cleanCode);
    if (ok) setVerifyCode('');
  }

  async function handleResend() {
    const sent = await onResendCode();
    setResendMessage(sent ? 'A new verification code was sent to your inbox.' : '');
  }

  return (
    <AuthCardWrapper>
      <View style={styles.iconHeroWrap}>
        <View style={[styles.iconHeroCircle, { backgroundColor: 'rgba(224, 52, 43, 0.12)' }]}>
          <Ionicons name="mail-open" size={32} color={colors.primary} />
        </View>
      </View>

      <Text style={styles.heading}>Verify your email</Text>
      <Text style={styles.sub}>
        We sent a 6-digit verification code to{'\n'}
        <Text style={styles.highlightText}>{pendingEmail || 'your email'}</Text>
        {'\n'}Check your inbox and spam folder.
      </Text>

      {devCode ? <DevCodeHint code={devCode} /> : null}

      <InputField
        label="Verification Code"
        icon="key-outline"
        placeholder="Enter 6-digit code"
        value={verifyCode}
        onChangeText={(code) => {
          setVerifyCode(code);
          setResendMessage('');
        }}
        keyboardType="numeric"
        maxLength={6}
      />

      {error ? <ErrorBox message={error} /> : null}
      {resendMessage ? <Text style={styles.resendMessage}>{resendMessage}</Text> : null}

      <View style={styles.submitRow}>
        <PrimaryButton
          label="Verify & Continue"
          icon="checkmark-circle-outline"
          onPress={handleVerify}
          disabled={verifyCode.length !== 6}
          loading={loading}
        />
      </View>

      <Pressable onPress={handleResend} disabled={loading} style={styles.resendBtn}>
        <Ionicons name="refresh-outline" size={15} color={loading ? colors.textMuted : colors.primary} />
        <Text style={[styles.link, loading && { color: colors.textMuted }]}>Resend code</Text>
      </Pressable>

      <BackLink label="Back to Sign in" onPress={onCancel} />
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
  highlightText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  submitRow: {
    marginVertical: 14,
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 6,
  },
  link: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: colors.primary,
  },
  resendMessage: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.success,
    textAlign: 'center',
    marginTop: 8,
  },
});
