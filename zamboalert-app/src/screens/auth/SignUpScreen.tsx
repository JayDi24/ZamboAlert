import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
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

type RoleCardProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  badge: string;
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
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
};

type AuthNavigation = {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
};

export default function SignUpScreen({ navigation }: { navigation: AuthNavigation }) {
  const { signUp, loading, error, clearError } = useAuth();
  const [role, setRole]                   = useState<'citizen' | 'rescuer'>('citizen');
  const [firstName, setFirstName]         = useState('');
  const [lastName, setLastName]           = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [confirm, setConfirm]             = useState('');
  const [showPassword, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [localError, setLocalError]       = useState('');

  const combinedError = localError || error;

  function handleChange() {
    if (localError) setLocalError('');
    if (error) clearError();
  }

  async function handleSignUp() {
    setLocalError('');
    if (!firstName.trim()) { setLocalError('Please enter your first name.'); return; }
    if (!lastName.trim()) { setLocalError('Please enter your last name.'); return; }
    if (!contactNumber.trim()) { setLocalError('Please enter your contact number.'); return; }
    if (contactNumber.trim().length < 7) { setLocalError('Please enter a valid contact number.'); return; }
    if (!email.includes('@') || !email.includes('.')) { setLocalError('Please enter a valid email address.'); return; }
    if (checkPasswordPolicy(password).score < MIN_PASSWORD_SCORE) {
      setLocalError('Password must meet at least 4 of the 5 requirements below.');
      return;
    }
    if (password !== confirm) { setLocalError('Passwords do not match.'); return; }

    const started = await signUp(firstName, lastName, email, password, role, contactNumber);
    if (started) {
      if (role === 'rescuer') {
        navigation.navigate('RescuerVerification', {
          registrationData: { firstName, lastName, email, role, contactNumber },
        });
      } else {
        navigation.navigate('Login');
      }
    }
  }

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
          {/* Header Brand Badge */}
          <View style={styles.brandHeader}>
            <View style={styles.badgePill}>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}>ZAMBOALERT NETWORK</Text>
            </View>
          </View>

          <View style={styles.authCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.kicker}>NEW REGISTRATION</Text>
              <Text style={styles.heading}>Create account</Text>
              <Text style={styles.sub}>
                Join the decentralized emergency mesh network for Barangay Tumaga.
              </Text>
            </View>

            {/* Role Selection */}
            <Text style={styles.fieldLabel}>Select your role</Text>
            <View style={styles.roleGrid}>
              <RoleCard
                label="Citizen"
                badge="Distress & Alerts"
                icon="person"
                description="I need emergency response and offline SOS tools."
                active={role === 'citizen'}
                onPress={() => { setRole('citizen'); handleChange(); }}
              />
              <RoleCard
                label="Rescuer"
                badge="Responder Mode"
                icon="shield-checkmark"
                description="I am a certified rescue responder or barangay personnel."
                active={role === 'rescuer'}
                onPress={() => { setRole('rescuer'); handleChange(); }}
              />
            </View>

            {/* Name 2-column row */}
            <View style={styles.nameRow}>
              <View style={styles.nameColumn}>
                <InputField
                  label="First Name"
                  icon="person-outline"
                  placeholder="Juan"
                  value={firstName}
                  onChangeText={(t) => { setFirstName(t); handleChange(); }}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.nameColumn}>
                <InputField
                  label="Last Name"
                  icon="person-outline"
                  placeholder="Dela Cruz"
                  value={lastName}
                  onChangeText={(t) => { setLastName(t); handleChange(); }}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <InputField
              label="Contact Number"
              icon="call-outline"
              placeholder="0912 345 6789"
              value={contactNumber}
              onChangeText={(t) => { setContactNumber(t); handleChange(); }}
              keyboardType="phone-pad"
            />

            <InputField
              label="Email Address"
              icon="mail-outline"
              placeholder="you@example.com"
              value={email}
              onChangeText={(t) => { setEmail(t); handleChange(); }}
              keyboardType="email-address"
            />

            <InputField
              label="Password"
              icon="lock-closed-outline"
              placeholder="Create strong password"
              value={password}
              onChangeText={(t) => { setPassword(t); handleChange(); }}
              secureTextEntry={!showPassword}
              rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowPass(!showPassword)}
            />

            <PasswordStrength password={password} />

            <InputField
              label="Confirm Password"
              icon="lock-closed-outline"
              placeholder="Re-enter password"
              value={confirm}
              onChangeText={(t) => { setConfirm(t); handleChange(); }}
              secureTextEntry={!showConfirm}
              rightIcon={showConfirm ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowConfirm(!showConfirm)}
            />

            {combinedError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={colors.primary} />
                <Text style={styles.errorText}>{combinedError}</Text>
              </View>
            ) : null}

            {role === 'rescuer' && (
              <View style={styles.rescuerNoticeBox}>
                <Ionicons name="information-circle" size={18} color="#2563EB" />
                <Text style={styles.rescuerNoticeText}>
                  Rescuer accounts require admin verification and document upload after signup.
                </Text>
              </View>
            )}

            <View style={styles.submitRow}>
              <PrimaryButton
                label={role === 'rescuer' ? 'Continue to Verification' : 'Create Account'}
                icon="checkmark-circle-outline"
                onPress={handleSignUp}
                disabled={!firstName.trim() || !lastName.trim() || !contactNumber.trim() || !email.trim() || !password || !confirm}
                loading={loading}
              />
            </View>

            {/* Switch to Login */}
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Already have an account?</Text>
              <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8} style={styles.switchLinkWrap}>
                <Text style={styles.switchLink}>Sign in</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.primary} />
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RoleCard({
  label,
  icon,
  badge,
  description,
  active,
  onPress,
}: RoleCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleCard,
        active && styles.roleCardActive,
        pressed && styles.roleCardPressed,
      ]}
    >
      <View style={styles.roleCardTop}>
        <View style={[styles.roleCardIconWrap, active && styles.roleCardIconWrapActive]}>
          <Ionicons name={icon} size={20} color={active ? colors.primary : colors.textSecondary} />
        </View>
        {active ? (
          <View style={styles.roleCheckmark}>
            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
          </View>
        ) : (
          <View style={styles.roleUnchecked} />
        )}
      </View>

      <Text style={[styles.roleCardLabel, active && styles.roleCardLabelActive]}>{label}</Text>
      <Text style={styles.roleCardDesc} numberOfLines={2}>{description}</Text>
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
  autoCapitalize,
  rightIcon,
  onRightIconPress,
}: InputFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.inputGroup}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
        <Ionicons
          name={icon}
          size={19}
          color={focused ? colors.primary : colors.textMuted}
          style={styles.inputLeadingIcon}
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize || 'none'}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {rightIcon ? (
          <Pressable onPress={onRightIconPress} hitSlop={10} style={styles.rightIconPressable}>
            <Ionicons name={rightIcon} size={19} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
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
    paddingBottom: 80,
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
    marginBottom: 24,
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
  roleCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFB',
    justifyContent: 'space-between',
    minHeight: 115,
  },
  roleCardActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(224, 52, 43, 0.03)',
  },
  roleCardPressed: {
    opacity: 0.85,
  },
  roleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleCardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardIconWrapActive: {
    backgroundColor: 'rgba(224, 52, 43, 0.12)',
  },
  roleCheckmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleUnchecked: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },
  roleCardLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14.5,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  roleCardLabelActive: {
    color: colors.primary,
  },
  roleCardDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
  },
  nameColumn: {
    flex: 1,
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
    fontFamily: 'Inter_400Regular',
    fontSize: 14.5,
    color: colors.textPrimary,
    height: '100%',
  },
  rightIconPressable: {
    padding: 4,
    marginLeft: 6,
  },
  rescuerNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  rescuerNoticeText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 17,
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
  submitRow: {
    marginTop: 4,
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
});
