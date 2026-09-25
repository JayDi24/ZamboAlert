import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet, TextInput,
  ScrollView, Pressable,
  KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { PrimaryButton } from '../../components/Button';
import PasswordStrength from '../../components/PasswordStrength';
import { useAuth, MIN_PASSWORD_SCORE, checkPasswordPolicy } from '../../context/AuthContext';
import WaitingForApprovalModal from '../../components/Approval';

type RolePillProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  subtitle: string;
  active: boolean;
  onPress: () => void;
};

type InputFieldProps = {
  label?: string;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  autoComplete?: any;
  textContentType?: any;
  maxLength?: number;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
};

type AuthNavigation = {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
};

export default function LoginScreen({ navigation }: { navigation: AuthNavigation }) {
  const {
    login, loading, error, clearError,
    authStep, pendingEmail, devCode,
    verifyEmailCode, resendVerificationCode,
    verifyMfaCode, cancelPendingAuth,
    requestPasswordReset, resetPassword,
    getLockoutSecondsRemaining,
  } = useAuth();

  const [role, setRole]             = useState<'citizen' | 'rescuer'>('citizen');
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
  const [showWaitingModal, setShowWaitingModal] = useState(false);

  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  useEffect(() => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) { setLockoutSeconds(0); return; }
    setLockoutSeconds(getLockoutSecondsRemaining(trimmedEmail));
  }, [email]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const t = setTimeout(() => setLockoutSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [lockoutSeconds]);

  function handleChange() { if (error) clearError(); }

  async function handleLogin() {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password || lockoutSeconds > 0) return;
    await login(cleanEmail, password, role);
  }

  async function handleVerifyEmail() {
    const cleanCode = verifyCode.trim();
    if (cleanCode.length !== 6) return;
    const ok = await verifyEmailCode(cleanCode);
    if (ok) setVerifyCode('');
  }

  async function handleVerifyMfa() {
    const cleanCode = mfaCode.trim();
    if (cleanCode.length !== 6) return;
    const ok = await verifyMfaCode(cleanCode);
    if (ok) setMfaCode('');
  }

  function openForgotPassword() {
    clearError();
    setForgotEmail(email.trim());
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
    const cleanEmail = forgotEmail.trim();
    if (!cleanEmail) return;
    const ok = await requestPasswordReset(cleanEmail);
    if (ok) setForgotStep(2);
  }

  async function handleForgotReset() {
    const cleanEmail = forgotEmail.trim();
    const cleanCode = forgotCode.trim();
    if (checkPasswordPolicy(newPassword).score < MIN_PASSWORD_SCORE || cleanCode.length !== 6) return;
    const ok = await resetPassword(cleanEmail, cleanCode, newPassword);
    if (ok) setForgotDone(true);
  }


  // ── Sub-screen: email verification ─────────────────────────────────────────
  if (authStep === 'verify_email') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <View pointerEvents="none" style={styles.bgDecorCircleTop} />
        <View pointerEvents="none" style={styles.bgDecorCircleBottom} />
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            <View style={styles.authCard}>
              <View style={styles.iconHeroWrap}>
                <View style={[styles.iconHeroCircle, { backgroundColor: 'rgba(224, 52, 43, 0.12)' }]}>
                  <Ionicons name="mail-open" size={32} color={colors.primary} />
                </View>
              </View>

              <Text style={styles.heading}>Verify your email</Text>
              <Text style={styles.sub}>
                We sent a 6-digit verification code to{'\n'}
                <Text style={styles.highlightText}>{pendingEmail || 'your email'}</Text>
              </Text>

              {devCode ? <DevCodeHint code={devCode} /> : null}

              <InputField
                label="Verification Code"
                icon="key-outline"
                placeholder="Enter 6-digit code"
                value={verifyCode}
                onChangeText={setVerifyCode}
                keyboardType="numeric"
                maxLength={6}
              />

              {error ? <ErrorBox message={error} /> : null}

              <View style={styles.submitRow}>
                <PrimaryButton
                  label="Verify & Continue"
                  icon="checkmark-circle-outline"
                  onPress={handleVerifyEmail}
                  disabled={verifyCode.length !== 6}
                  loading={loading}
                />
              </View>

              <Pressable onPress={resendVerificationCode} style={styles.resendBtn}>
                <Ionicons name="refresh-outline" size={15} color={colors.primary} />
                <Text style={styles.link}>Resend code</Text>
              </Pressable>

              <BackLink label="Back to Sign in" onPress={cancelPendingAuth} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Sub-screen: MFA verification ───────────────────────────────────────────
  if (authStep === 'mfa') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <View pointerEvents="none" style={styles.bgDecorCircleTop} />
        <View pointerEvents="none" style={styles.bgDecorCircleBottom} />
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            <View style={styles.authCard}>
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

              <BackLink label="Cancel and Sign Out" onPress={cancelPendingAuth} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Sub-screen: forgot password ────────────────────────────────────────────
  if (forgotVisible) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
        <View pointerEvents="none" style={styles.bgDecorCircleTop} />
        <View pointerEvents="none" style={styles.bgDecorCircleBottom} />
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            <View style={styles.authCard}>
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
                    <PrimaryButton label="Back to Sign in" icon="log-in-outline" onPress={closeForgotPassword} />
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

              <BackLink label="Back to Sign in" onPress={closeForgotPassword} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Main Screen: Login ─────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <View pointerEvents="none" style={styles.bgDecorCircleTop} />
      <View pointerEvents="none" style={styles.bgDecorCircleBottom} />

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={true}
        >

          <View style={styles.authCard}>
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
                onPress={() => { setRole('citizen'); handleChange(); }}
              />
              <RolePill
                label="Rescuer"
                subtitle="Field Responder"
                icon="shield-checkmark-outline"
                active={role === 'rescuer'}
                onPress={() => { setRole('rescuer'); handleChange(); }}
              />
            </View>

            {/* Input Fields */}
            <InputField
              label="Email Address"
              icon="mail-outline"
              placeholder="you@example.com"
              value={email}
              onChangeText={(t) => { setEmail(t); handleChange(); }}
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
              onChangeText={(t) => { setPassword(t); handleChange(); }}
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
              <Pressable onPress={openForgotPassword} style={styles.forgotBtn} hitSlop={8}>
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
              <Pressable onPress={() => navigation.navigate('SignUp')} hitSlop={8} style={styles.switchLinkWrap}>
                <Text style={styles.switchLink}>Create account</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.primary} />
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <WaitingForApprovalModal
        visible={showWaitingModal}
        onClose={() => setShowWaitingModal(false)}
        rescuerName={role === 'rescuer' ? 'Rescuer Applicant' : 'Applicant'}
        rescuerEmail={email || pendingEmail}
        idType="Government / Barangay ID"
      />
    </SafeAreaView>
  );
}

function ErrorBox({
  message,
  onOpenApprovalModal,
}: {
  message: string;
  onOpenApprovalModal?: () => void;
}) {
  const isPending = message.toLowerCase().includes('pending admin verification') || message.toLowerCase().includes('pending approval');

  if (isPending) {
    return (
      <View style={styles.pendingBox}>
        <View style={styles.pendingIconWrap}>
          <Ionicons name="hourglass" size={18} color="#D97706" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pendingTitle}>Verification Pending</Text>
          <Text style={styles.pendingText}>{message}</Text>
          {onOpenApprovalModal ? (
            <Pressable onPress={onOpenApprovalModal} style={styles.pendingActionBtn}>
              <Text style={styles.pendingActionText}>View Approval Status</Text>
              <Ionicons name="chevron-forward" size={13} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle" size={18} color={colors.primary} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function DevCodeHint({ code }: { code: string }) {
  return (
    <View style={styles.devBox}>
      <Ionicons name="bulb-outline" size={16} color="#D97706" />
      <Text style={styles.devText}>
        Test Environment Demo Code: <Text style={styles.devCode}>{code}</Text>
      </Text>
    </View>
  );
}

function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.backLink} hitSlop={8}>
      <Ionicons name="arrow-back-outline" size={15} color={colors.textSecondary} />
      <Text style={styles.backLinkText}>{label}</Text>
    </Pressable>
  );
}

function RolePill({ label, subtitle, icon, active, onPress }: RolePillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.rolePill,
        active && styles.rolePillActive,
        pressed && styles.rolePillPressed,
      ]}
    >
      <View style={[styles.roleIconWrap, active && styles.roleIconWrapActive]}>
        <Ionicons name={icon} size={20} color={active ? colors.primary : colors.textSecondary} />
      </View>
      <View style={styles.roleTextWrap}>
        <Text style={[styles.rolePillTitle, active && styles.rolePillTitleActive]}>{label}</Text>
        <Text style={[styles.rolePillSub, active && styles.rolePillSubActive]}>{subtitle}</Text>
      </View>
      {active && (
        <View style={styles.activeCheckmark}>
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
}

function InputField({
  label,
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  autoCorrect = false,
  autoComplete,
  textContentType,
  maxLength,
  rightIcon,
  onRightIconPress,
}: InputFieldProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={styles.inputGroup}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={[styles.inputWrap, focused && styles.inputWrapFocused]}
      >
        <Ionicons
          name={icon}
          size={19}
          color={focused ? colors.primary : colors.textMuted}
          style={styles.inputLeadingIcon}
        />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoComplete={autoComplete}
          textContentType={textContentType}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {rightIcon ? (
          <Pressable onPress={onRightIconPress} hitSlop={10} style={styles.rightIconPressable}>
            <Ionicons name={rightIcon} size={19} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  keyboardAvoid: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  bgDecorCircleTop: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(224, 52, 43, 0.08)',
  },
  bgDecorCircleBottom: {
    position: 'absolute',
    bottom: -100,
    left: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(47, 111, 237, 0.04)',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 70,
    alignItems: 'center',
    width: '100%',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 14,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  badgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.primary,
  },
  authCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: '#EAECEF',
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
    marginBottom: 20,
  },
  cardHeader: {
    marginBottom: 20,
  },
  kicker: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
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
  highlightText: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
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
  rolePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFB',
    position: 'relative',
    gap: 8,
  },
  rolePillActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(224, 52, 43, 0.04)',
  },
  rolePillPressed: {
    opacity: 0.85,
  },
  roleIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconWrapActive: {
    backgroundColor: 'rgba(224, 52, 43, 0.12)',
  },
  roleTextWrap: {
    flex: 1,
  },
  rolePillTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    color: colors.textPrimary,
  },
  rolePillTitleActive: {
    color: colors.primary,
  },
  rolePillSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10.5,
    color: colors.textMuted,
    marginTop: 1,
  },
  rolePillSubActive: {
    color: colors.primary,
    opacity: 0.85,
  },
  activeCheckmark: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    height: 52,
  },
  inputWrapFocused: {
    borderColor: colors.primary,
    backgroundColor: '#FFFFFF',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  inputLeadingIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    color: colors.textPrimary,
    height: '100%',
    paddingVertical: 0,
  },
  rightIconPressable: {
    padding: 4,
    marginLeft: 6,
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
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(224, 52, 43, 0.08)',
    borderColor: 'rgba(224, 52, 43, 0.25)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: colors.primary,
    lineHeight: 18,
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
  pendingBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  pendingIconWrap: {
    marginTop: 2,
  },
  pendingTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#92400E',
  },
  pendingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 17,
  },
  pendingActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
    gap: 4,
  },
  pendingActionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  devBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  devText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#92400E',
  },
  devCode: {
    fontFamily: 'Inter_700Bold',
    color: '#B45309',
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
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
  },
  backLinkText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: colors.textSecondary,
  },
});
