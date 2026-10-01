import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { PrimaryButton } from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import WaitingForApprovalModal from '../../components/Approval';
import {
  InputField,
  ErrorBox,
  RolePill,
  AuthCardWrapper,
} from './components/AuthComponents';
import { VerifyEmailView } from './components/VerifyEmailView';
import { MfaVerifyView } from './components/MfaVerifyView';
import { ForgotPasswordView } from './components/ForgotPasswordView';

type AuthNavigation = {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
};

export default function LoginScreen({ navigation }: { navigation: AuthNavigation }) {
  const {
    login,
    loading,
    error,
    clearError,
    authStep,
    pendingEmail,
    devCode,
    verifyEmailCode,
    resendVerificationCode,
    verifyMfaCode,
    cancelPendingAuth,
    requestPasswordReset,
    resetPassword,
    getLockoutSecondsRemaining,
  } = useAuth();

  const [role, setRole] = useState<'citizen' | 'rescuer'>('citizen');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPass] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  useEffect(() => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLockoutSeconds(0);
      return;
    }
    setLockoutSeconds(getLockoutSecondsRemaining(trimmedEmail));
  }, [email, getLockoutSecondsRemaining]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const t = setTimeout(() => setLockoutSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [lockoutSeconds]);

  function handleChange() {
    if (error) clearError();
  }

  async function handleLogin() {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password || lockoutSeconds > 0) return;
    await login(cleanEmail, password, role);
  }

  // ── Sub-screen: Email Verification ──────────────────────────────────────────
  if (authStep === 'verify_email') {
    return (
      <VerifyEmailView
        pendingEmail={pendingEmail}
        devCode={devCode}
        error={error}
        loading={loading}
        onVerify={verifyEmailCode}
        onResendCode={resendVerificationCode}
        onCancel={cancelPendingAuth}
      />
    );
  }

  // ── Sub-screen: MFA Verification ────────────────────────────────────────────
  if (authStep === 'mfa') {
    return (
      <MfaVerifyView
        error={error}
        loading={loading}
        onVerify={verifyMfaCode}
        onCancel={cancelPendingAuth}
      />
    );
  }

  // ── Sub-screen: Forgot Password ─────────────────────────────────────────────
  if (forgotVisible) {
    return (
      <ForgotPasswordView
        initialEmail={email.trim()}
        devCode={devCode}
        error={error}
        loading={loading}
        onRequestReset={requestPasswordReset}
        onResetPassword={resetPassword}
        onClose={() => {
          setForgotVisible(false);
          clearError();
        }}
      />
    );
  }

  // ── Main Screen: Login ──────────────────────────────────────────────────────
  return (
    <AuthCardWrapper>
      <View style={styles.cardHeader}>
        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.sub}>
          Sign in to stay connected and alert responders even during network outages.
        </Text>
      </View>

      {/* Role Selection */}
      <Text style={styles.fieldLabel}>I am signing in as</Text>
      <View style={styles.roleGrid}>
        <RolePill
          label="Citizen"
          subtitle="SOS & Emergency"
          icon="person-circle-outline"
          active={role === 'citizen'}
          onPress={() => {
            setRole('citizen');
            handleChange();
          }}
        />
        <RolePill
          label="Rescuer"
          subtitle="Field Responder"
          icon="shield-checkmark-outline"
          active={role === 'rescuer'}
          onPress={() => {
            setRole('rescuer');
            handleChange();
          }}
        />
      </View>

      {/* Input Fields */}
      <InputField
        label="Email Address"
        icon="mail-outline"
        placeholder="you@example.com"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          handleChange();
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
      />

      <InputField
        label="Password"
        icon="lock-closed-outline"
        placeholder="Enter your password"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          handleChange();
        }}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password"
        textContentType="password"
        rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
        onRightIconPress={() => setShowPass(!showPassword)}
      />

      {lockoutSeconds > 0 ? (
        <View style={styles.lockoutBox}>
          <Ionicons name="time" size={16} color={colors.primary} />
          <Text style={styles.lockoutText}>
            Account locked for security. Try again in {lockoutSeconds}s.
          </Text>
        </View>
      ) : null}

      {error ? (
        <ErrorBox
          message={error}
          onOpenApprovalModal={() => setShowWaitingModal(true)}
        />
      ) : null}

      <View style={styles.actionRow}>
        <Pressable
          onPress={() => {
            clearError();
            setForgotVisible(true);
          }}
          style={styles.forgotBtn}
          hitSlop={8}
        >
          <Text style={styles.linkText}>Forgot password?</Text>
        </Pressable>
      </View>

      <View style={styles.submitRow}>
        <PrimaryButton
          label="Log In"
          icon="log-in-outline"
          onPress={handleLogin}
          disabled={!email.trim() || !password || lockoutSeconds > 0}
          loading={loading}
        />
      </View>

      {/* Switch to Sign up */}
      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Don't have an account yet?</Text>
        <Pressable
          onPress={() => navigation.navigate('SignUp')}
          hitSlop={8}
          style={styles.switchLinkWrap}
        >
          <Text style={styles.switchLink}>Create account</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.primary} />
        </Pressable>
      </View>

      <WaitingForApprovalModal
        visible={showWaitingModal}
        onClose={() => setShowWaitingModal(false)}
        rescuerName={role === 'rescuer' ? 'Rescuer Applicant' : 'Applicant'}
        rescuerEmail={email || pendingEmail}
        idType="Government / Barangay ID"
      />
    </AuthCardWrapper>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    marginBottom: 20,
  },
  heading: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  sub: {
    marginTop: 6,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#374151',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
    marginTop: 2,
  },
  forgotBtn: {
    paddingVertical: 4,
  },
  linkText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: colors.primary,
  },
  submitRow: {
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 6,
  },
  switchText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
  },
  switchLinkWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  switchLink: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: colors.primary,
  },
  lockoutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(224, 52, 43, 0.08)',
    borderColor: 'rgba(224, 52, 43, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  lockoutText: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: colors.primary,
  },
});
