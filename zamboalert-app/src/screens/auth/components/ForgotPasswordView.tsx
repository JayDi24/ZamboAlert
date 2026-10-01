import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { PrimaryButton } from '../../../components/Button';
import PasswordStrength from '../../../components/PasswordStrength';
import { MIN_PASSWORD_SCORE, checkPasswordPolicy } from '../../../context/AuthContext';
import {
  InputField,
  ErrorBox,
  DevCodeHint,
  BackLink,
  AuthCardWrapper,
} from './AuthComponents';

interface ForgotPasswordViewProps {
  initialEmail: string;
  devCode: string | null;
  error: string;
  loading: boolean;
  onRequestReset: (email: string) => Promise<boolean>;
  onResetPassword: (email: string, code: string, pass: string) => Promise<boolean>;
  onClose: () => void;
}

export function ForgotPasswordView({
  initialEmail,
  devCode,
  error,
  loading,
  onRequestReset,
  onResetPassword,
  onClose,
}: ForgotPasswordViewProps) {
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail] = useState(initialEmail);
  const [forgotCode, setForgotCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPass] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);

  async function handleForgotRequest() {
    const cleanEmail = forgotEmail.trim();
    if (!cleanEmail) return;
    const ok = await onRequestReset(cleanEmail);
    if (ok) setForgotStep(2);
  }

  async function handleForgotReset() {
    const cleanEmail = forgotEmail.trim();
    const cleanCode = forgotCode.trim();
    if (checkPasswordPolicy(newPassword).score < MIN_PASSWORD_SCORE || cleanCode.length !== 6) return;
    const ok = await onResetPassword(cleanEmail, cleanCode, newPassword);
    if (ok) setForgotDone(true);
  }

  return (
    <AuthCardWrapper>
      {forgotDone ? (
        <>
          <View style={styles.iconHeroWrap}>
            <View style={[styles.iconHeroCircle, { backgroundColor: 'rgba(34, 197, 94, 0.12)' }]}>
              <Ionicons name="checkmark-circle" size={36} color={colors.success} />
            </View>
          </View>
          <Text style={styles.heading}>Password Reset!</Text>
          <Text style={styles.sub}>
            Your account password has been successfully updated. You can now sign in with your new credentials.
          </Text>
          <View style={styles.submitRow}>
            <PrimaryButton label="Back to Sign in" icon="log-in-outline" onPress={onClose} />
          </View>
        </>
      ) : forgotStep === 1 ? (
        <>
          <View style={styles.iconHeroWrap}>
            <View style={[styles.iconHeroCircle, { backgroundColor: 'rgba(224, 52, 43, 0.12)' }]}>
              <Ionicons name="lock-open-outline" size={32} color={colors.primary} />
            </View>
          </View>
          <Text style={styles.heading}>Reset Password</Text>
          <Text style={styles.sub}>
            Enter your account email address and we'll send you a 6-digit recovery code.
          </Text>

          <InputField
            label="Account Email"
            icon="mail-outline"
            placeholder="you@example.com"
            value={forgotEmail}
            onChangeText={setForgotEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
          />

          {error ? <ErrorBox message={error} /> : null}

          <View style={styles.submitRow}>
            <PrimaryButton
              label="Send Recovery Code"
              icon="paper-plane-outline"
              onPress={handleForgotRequest}
              disabled={!forgotEmail.trim()}
              loading={loading}
            />
          </View>
        </>
      ) : (
        <>
          <View style={styles.iconHeroWrap}>
            <View style={[styles.iconHeroCircle, { backgroundColor: 'rgba(224, 52, 43, 0.12)' }]}>
              <Ionicons name="key-outline" size={32} color={colors.primary} />
            </View>
          </View>
          <Text style={styles.heading}>New Password</Text>
          <Text style={styles.sub}>
            Enter the code sent to <Text style={styles.highlightText}>{forgotEmail}</Text> and choose a strong password.
          </Text>

          {devCode ? <DevCodeHint code={devCode} /> : null}

          <InputField
            label="Recovery Code"
            icon="key-outline"
            placeholder="6-digit recovery code"
            value={forgotCode}
            onChangeText={setForgotCode}
            keyboardType="numeric"
            maxLength={6}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <InputField
            label="New Password"
            icon="lock-closed-outline"
            placeholder="At least 8 characters"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            rightIcon={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowNewPass(!showNewPassword)}
          />

          <PasswordStrength password={newPassword} />

          {error ? <ErrorBox message={error} /> : null}

          <View style={styles.submitRow}>
            <PrimaryButton
              label="Reset Password"
              icon="checkmark-circle-outline"
              onPress={handleForgotReset}
              disabled={forgotCode.length !== 6 || checkPasswordPolicy(newPassword).score < MIN_PASSWORD_SCORE}
              loading={loading}
            />
          </View>

          <Pressable onPress={() => setForgotStep(1)} style={styles.resendBtn}>
            <Ionicons name="arrow-back-outline" size={14} color={colors.primary} />
            <Text style={styles.link}>Use a different email</Text>
          </Pressable>
        </>
      )}

      <BackLink label="Back to Sign in" onPress={onClose} />
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
});
