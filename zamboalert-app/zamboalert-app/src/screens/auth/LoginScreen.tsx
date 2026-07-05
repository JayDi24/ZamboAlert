import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  ScrollView, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { PrimaryButton, SecondaryButton } from '../../components/Button';
import PasswordStrength from '../../components/PasswordStrength';
import { useAuth, MIN_PASSWORD_SCORE, checkPasswordPolicy } from '../../context/AuthContext';

type RolePillProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
};

type InputFieldProps = {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  maxLength?: number;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
};

export default function LoginScreen({ navigation }) {
  const {
    login, loading, error, clearError,
    authStep, pendingEmail, devCode,
    verifyEmailCode, resendVerificationCode,
    verifyMfaCode, cancelPendingAuth,
    requestPasswordReset, resetPassword,
    getLockoutSecondsRemaining,
  } = useAuth();

  const [role, setRole]             = useState('citizen');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPass] = useState(false);

  const [verifyCode, setVerifyCode] = useState('');
  const [mfaCode, setMfaCode]       = useState('');

  const [forgotVisible, setForgotVisible]   = useState(false);
  const [forgotStep, setForgotStep]         = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail]       = useState('');
  const [forgotCode, setForgotCode]         = useState('');
  const [newPassword, setNewPassword]       = useState('');
  const [showNewPassword, setShowNewPass]   = useState(false);
  const [forgotDone, setForgotDone]         = useState(false);

  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  useEffect(() => {
    if (!email.trim()) { setLockoutSeconds(0); return; }
    setLockoutSeconds(getLockoutSecondsRemaining(email));
  }, [email]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const t = setTimeout(() => setLockoutSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [lockoutSeconds]);

  function handleChange() { if (error) clearError(); }

  async function handleLogin() {
    if (!email.trim() || !password || lockoutSeconds > 0) return;
    await login(email, password, role);
  }

  async function handleVerifyEmail() {
    if (verifyCode.length !== 6) return;
    const ok = await verifyEmailCode(verifyCode);
    if (ok) setVerifyCode('');
  }

  async function handleVerifyMfa() {
    if (mfaCode.length !== 6) return;
    const ok = await verifyMfaCode(mfaCode);
    if (ok) setMfaCode('');
  }

  function openForgotPassword() {
    clearError();
    setForgotEmail(email);
    setForgotStep(1);
    setForgotDone(false);
    setForgotVisible(true);
  }

  function closeForgotPassword() {
    setForgotVisible(false);
    setForgotStep(1);
    setForgotEmail('');
    setForgotCode('');
    setNewPassword('');
    setForgotDone(false);
    clearError();
  }

  async function handleForgotRequest() {
    if (!forgotEmail.trim()) return;
    const ok = await requestPasswordReset(forgotEmail);
    if (ok) setForgotStep(2);
  }

  async function handleForgotReset() {
    if (checkPasswordPolicy(newPassword).score < MIN_PASSWORD_SCORE || forgotCode.length !== 6) return;
    const ok = await resetPassword(forgotEmail, forgotCode, newPassword);
    if (ok) setForgotDone(true);
  }

  // ── Sub-screen: email verification (post-login or post-signup) ──────────
  if (authStep === 'verify_email') {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Header />
            <View style={styles.instructionCard}>
              <Ionicons name="mail-open-outline" size={22} color={colors.primary} />
              <Text style={styles.instructionText}>
                We've sent a 6-digit code to{'\n'}
                <Text style={styles.instructionEmail}>{pendingEmail}</Text>
              </Text>
            </View>

            {devCode ? <DevCodeHint code={devCode} /> : null}

            <Text style={[typography.eyebrow, styles.fieldLabel]}>Verification code</Text>
            <InputField icon="key-outline" placeholder="6-digit code" value={verifyCode}
              onChangeText={setVerifyCode} keyboardType="numeric" maxLength={6} />

            {error ? <ErrorBox message={error} /> : null}

            <View style={styles.submitRow}>
              {loading
                ? <ActivityIndicator color={colors.primary} size="large" />
                : <PrimaryButton label="Verify email" icon="checkmark-circle-outline" onPress={handleVerifyEmail} disabled={verifyCode.length !== 6} />
              }
            </View>

            <Pressable onPress={resendVerificationCode} style={styles.linkRow}>
              <Ionicons name="refresh-outline" size={14} color={colors.primary} />
              <Text style={styles.link}>Resend code</Text>
            </Pressable>

            <BackLink label="Back to sign in" onPress={cancelPendingAuth} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Sub-screen: MFA verification ─────────────────────────────────────────
  if (authStep === 'mfa') {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Header />
            <View style={styles.instructionCard}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.success} />
              <Text style={styles.instructionText}>
                Two-factor authentication is on for this account. Enter the 6-digit code from your authenticator app.
              </Text>
            </View>

            <Text style={[typography.eyebrow, styles.fieldLabel]}>Authentication code</Text>
            <InputField icon="shield-checkmark-outline" placeholder="6-digit code" value={mfaCode}
              onChangeText={setMfaCode} keyboardType="numeric" maxLength={6} />

            {error ? <ErrorBox message={error} /> : null}

            <View style={styles.submitRow}>
              {loading
                ? <ActivityIndicator color={colors.primary} size="large" />
                : <PrimaryButton label="Verify and sign in" icon="log-in-outline" onPress={handleVerifyMfa} disabled={mfaCode.length !== 6} />
              }
            </View>

            <BackLink label="Cancel" onPress={cancelPendingAuth} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Sub-screen: forgot password ──────────────────────────────────────────
  if (forgotVisible) {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Header />

            {forgotDone ? (
              <>
                <View style={styles.instructionCard}>
                  <Ionicons name="checkmark-circle-outline" size={22} color={colors.success} />
                  <Text style={styles.instructionText}>Your password has been reset. You can sign in now.</Text>
                </View>
                <View style={styles.submitRow}>
                  <PrimaryButton label="Back to sign in" icon="log-in-outline" onPress={closeForgotPassword} />
                </View>
              </>
            ) : forgotStep === 1 ? (
              <>
                <View style={styles.instructionCard}>
                  <Ionicons name="lock-open-outline" size={22} color={colors.statusUnknown} />
                  <Text style={styles.instructionText}>
                    Enter your account email. If we find it, we'll send a 6-digit recovery code.
                  </Text>
                </View>

                <Text style={[typography.eyebrow, styles.fieldLabel]}>Email</Text>
                <InputField icon="mail-outline" placeholder="you@example.com" value={forgotEmail}
                  onChangeText={setForgotEmail} keyboardType="email-address" />

                {error ? <ErrorBox message={error} /> : null}

                <View style={styles.submitRow}>
                  {loading
                    ? <ActivityIndicator color={colors.primary} size="large" />
                    : <PrimaryButton label="Send recovery code" icon="paper-plane-outline" onPress={handleForgotRequest} disabled={!forgotEmail.trim()} />
                  }
                </View>
              </>
            ) : (
              <>
                <View style={styles.instructionCard}>
                  <Ionicons name="key-outline" size={22} color={colors.success} />
                  <Text style={styles.instructionText}>
                    Enter the code sent to {forgotEmail} and choose a new password.
                  </Text>
                </View>

                {devCode ? <DevCodeHint code={devCode} /> : null}

                <Text style={[typography.eyebrow, styles.fieldLabel]}>Recovery code</Text>
                <InputField icon="key-outline" placeholder="6-digit code" value={forgotCode}
                  onChangeText={setForgotCode} keyboardType="numeric" maxLength={6} />

                <Text style={[typography.eyebrow, styles.fieldLabel]}>New password</Text>
                <InputField icon="lock-closed-outline" placeholder="At least 8 characters" value={newPassword}
                  onChangeText={setNewPassword} secureTextEntry={!showNewPassword}
                  rightIcon={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                  onRightIconPress={() => setShowNewPass(!showNewPassword)} />

                <PasswordStrength password={newPassword} />

                {error ? <ErrorBox message={error} /> : null}

                <View style={styles.submitRow}>
                  {loading
                    ? <ActivityIndicator color={colors.primary} size="large" />
                    : <PrimaryButton label="Reset password" icon="checkmark-circle-outline" onPress={handleForgotReset}
                        disabled={forgotCode.length !== 6 || checkPasswordPolicy(newPassword).score < MIN_PASSWORD_SCORE} />
                  }
                </View>

                <Pressable onPress={() => setForgotStep(1)} style={styles.linkRow}>
                  <Text style={styles.link}>Use a different email</Text>
                </Pressable>
              </>
            )}

            <BackLink label="Back to sign in" onPress={closeForgotPassword} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Main screen: login ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <Header />

          <Text style={styles.heading}>Welcome back</Text>
          <Text style={[styles.sub, { color: colors.primary }]}>
            Sign in to your account to continue and stay alert.
          </Text>

          <Text style={[typography.eyebrow, styles.fieldLabel]}>I am a</Text>
          <View style={styles.roleRow}>
            <RolePill label="Citizen" icon="person-outline"  active={role === 'citizen'} onPress={() => { setRole('citizen');  handleChange(); }} />
            <RolePill label="Rescuer" icon="shield-outline"  active={role === 'rescuer'} onPress={() => { setRole('rescuer'); handleChange(); }} />
          </View>

          <Text style={[typography.eyebrow, styles.fieldLabel]}>Email</Text>
          <InputField icon="mail-outline" placeholder="you@example.com" value={email}
            onChangeText={(t) => { setEmail(t); handleChange(); }} keyboardType="email-address" />

          <Text style={[typography.eyebrow, styles.fieldLabel]}>Password</Text>
          <InputField icon="lock-closed-outline" placeholder="Your password" value={password}
            onChangeText={(t) => { setPassword(t); handleChange(); }}
            secureTextEntry={!showPassword}
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowPass(!showPassword)} />

          {lockoutSeconds > 0 ? (
            <View style={styles.lockoutBox}>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
              <Text style={styles.lockoutText}>
                Account locked for security. Try again in {lockoutSeconds}s.
              </Text>
            </View>
          ) : null}

          {error ? <ErrorBox message={error} /> : null}

          <Pressable onPress={openForgotPassword} style={styles.forgotBtn}>
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>

          <View style={styles.submitRow}>
            {loading
              ? <ActivityIndicator color={colors.primary} size="large" />
              : <PrimaryButton label="Log in" icon="log-in-outline" onPress={handleLogin}
                  disabled={!email.trim() || !password || lockoutSeconds > 0} />
            }
          </View>

          <View style={styles.demoBox}>
            <Ionicons name="information-circle-outline" size={15} color={colors.textSecondary} />
            <Text style={[typography.meta, styles.demoText]}>
              Demo — Citizen: citizen@test.com / Rescuer: rescuer@test.com{'\n'}Password: test1234
            </Text>
          </View>

          <View style={styles.switchRow}>
            <Text style={typography.meta}>Don't have an account? </Text>
            <Pressable onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.link}>Sign up</Text>
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.logoRow}>
      <View style={styles.logoChip}>
        <Ionicons name="play" size={18} color={colors.textOnPrimary} />
      </View>
      <Text style={typography.appTitle}>ZamboAlert</Text>
    </View>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function DevCodeHint({ code }: { code: string }) {
  return (
    <View style={styles.devBox}>
      <Ionicons name="bulb-outline" size={14} color={colors.textSecondary} />
      <Text style={[typography.meta, styles.devText]}>
        Offline demo — your code is <Text style={styles.devCode}>{code}</Text>
      </Text>
    </View>
  );
}

function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.backLink}>
      <Ionicons name="arrow-back-outline" size={14} color={colors.textSecondary} />
      <Text style={styles.backLinkText}>{label}</Text>
    </Pressable>
  );
}

function RolePill({ label, icon, active, onPress }: RolePillProps) {
  return (
    <Pressable onPress={onPress} style={[styles.rolePill, active && styles.rolePillActive]}>
      <Ionicons name={icon} size={18} color={active ? colors.primary : colors.textSecondary} />
      <Text style={[styles.rolePillText, active && styles.rolePillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function InputField({ icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, maxLength, rightIcon, onRightIconPress }: InputFieldProps) {
  return (
    <View style={styles.inputWrap}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor={colors.textMuted}
        value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry}
        keyboardType={keyboardType} maxLength={maxLength} autoCapitalize="none" autoCorrect={false} />
      {rightIcon ? (
        <Pressable onPress={onRightIconPress} hitSlop={8}>
          <Ionicons name={rightIcon} size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  logoChip: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 26, color: colors.textPrimary },
  sub: { marginTop: 4, marginBottom: 28, lineHeight: 19, fontFamily: 'Inter_400Regular', fontSize: 13 },
  fieldLabel: { marginBottom: 8 },
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  rolePill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  rolePillActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  rolePillText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.textSecondary },
  rolePillTextActive: { color: colors.primary },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16, gap: 10 },
  input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.textPrimary },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(224,52,43,0.08)', borderRadius: 10, padding: 12, marginBottom: 8 },
  errorText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.primary, lineHeight: 18 },
  lockoutBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(224,52,43,0.08)', borderRadius: 10, padding: 12, marginBottom: 8 },
  lockoutText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: colors.primary },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 18, marginTop: 4 },
  submitRow: { marginTop: 8, marginBottom: 16 },
  demoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.inactiveBg, borderRadius: 10, padding: 12, marginBottom: 24 },
  demoText: { flex: 1, lineHeight: 18 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 8 },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.primary },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, marginBottom: 4 },
  instructionCard: { alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 20 },
  instructionText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  instructionEmail: { fontFamily: 'Inter_700Bold', color: colors.textPrimary },
  devBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.inactiveBg, borderRadius: 10, padding: 12, marginBottom: 16 },
  devText: { flex: 1, lineHeight: 17 },
  devCode: { fontFamily: 'Inter_700Bold', color: colors.textPrimary },
  backLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingBottom: 8 },
  backLinkText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.textSecondary },
});
