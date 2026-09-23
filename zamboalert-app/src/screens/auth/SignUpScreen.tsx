import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  ScrollView, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { PrimaryButton } from '../../components/Button';
import PasswordStrength from '../../components/PasswordStrength';
import { useAuth, MIN_PASSWORD_SCORE, checkPasswordPolicy } from '../../context/AuthContext';

type RolePillProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
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
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
};

type AuthNavigation = {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
};

export default function SignUpScreen({ navigation }: { navigation: AuthNavigation }) {
  const { signUp, loading, error, clearError } = useAuth();
  const [role, setRole]               = useState('citizen');
  const [firstName, setFirstName]     = useState('');
  const [lastName, setLastName]       = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPassword, setShowPass]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localError, setLocalError]   = useState('');

  const combinedError = localError || error;
  function handleChange() { if (localError) setLocalError(''); if (error) clearError(); }

  async function handleSignUp() {
    setLocalError('');
    if (!firstName.trim())    { setLocalError('Please enter your first name.'); return; }
    if (!lastName.trim())     { setLocalError('Please enter your last name.'); return; }
    if (!contactNumber.trim()) { setLocalError('Please enter your contact number.'); return; }
    if (contactNumber.trim().length < 7) { setLocalError('Please enter a valid contact number.'); return; }
    if (!email.includes('@')) { setLocalError('Please enter a valid email address.'); return; }
    if (checkPasswordPolicy(password).score < MIN_PASSWORD_SCORE) {
      setLocalError('Password must meet at least 4 of the 5 requirements below.');
      return;
    }
    if (password !== confirm) { setLocalError('Passwords do not match.'); return; }

    const started = await signUp(firstName, lastName, email, password, role, contactNumber);
    // On success, navigate rescuers to the dedicated verification screen
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.backdropGlow} />
      <View style={styles.backdropGlowSecondary} />
      <View style={styles.headerWrap} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.authCard}>
            <Text style={styles.kicker}>Create account</Text>
            <Text style={styles.heading}>Join the network</Text>
            <Text style={styles.sub}>
              Tell us who you are so we can route you to the right experience.
            </Text>

            <Text style={[typography.eyebrow, styles.fieldLabel]}>I am a</Text>
            <View style={styles.roleRow}>
              <RolePill label="Citizen" icon="person-outline" description="I need to send an SOS" active={role === 'citizen'} onPress={() => { setRole('citizen'); handleChange(); }} />
              <RolePill label="Rescuer" icon="shield-outline" description="I respond to emergencies" active={role === 'rescuer'} onPress={() => { setRole('rescuer'); handleChange(); }} />
            </View>

            <View style={styles.nameRow}>
              <View style={styles.nameColumn}>
                <Text style={[typography.eyebrow, styles.fieldLabel]}>First name</Text>
                <InputField icon="person-outline" placeholder="John" value={firstName}
                  onChangeText={(t) => { setFirstName(t); handleChange(); }} autoCapitalize="words" />
              </View>
              <View style={styles.nameColumn}>
                <Text style={[typography.eyebrow, styles.fieldLabel]}>Last name</Text>
                <InputField icon="person-outline" placeholder="Doe" value={lastName}
                  onChangeText={(t) => { setLastName(t); handleChange(); }} autoCapitalize="words" />
              </View>
            </View>

            <Text style={[typography.eyebrow, styles.fieldLabel]}>Contact number</Text>
            <InputField icon="call-outline" placeholder="Enter your number" value={contactNumber}
              onChangeText={(t) => { setContactNumber(t); handleChange(); }} keyboardType="phone-pad" />

            <Text style={[typography.eyebrow, styles.fieldLabel]}>Email</Text>
            <InputField icon="mail-outline" placeholder="you@example.com" value={email}
              onChangeText={(t) => { setEmail(t); handleChange(); }} keyboardType="email-address" />

            <Text style={[typography.eyebrow, styles.fieldLabel]}>Password</Text>
            <InputField icon="lock-closed-outline" placeholder="At least 8 characters" value={password}
              onChangeText={(t) => { setPassword(t); handleChange(); }}
              secureTextEntry={!showPassword}
              rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowPass(!showPassword)} />

            <PasswordStrength password={password} />

            <Text style={[typography.eyebrow, styles.fieldLabel]}>Confirm password</Text>
            <InputField icon="lock-closed-outline" placeholder="Re-enter your password" value={confirm}
              onChangeText={(t) => { setConfirm(t); handleChange(); }}
              secureTextEntry={!showConfirm}
              rightIcon={showConfirm ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowConfirm(!showConfirm)} />

            {combinedError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
                <Text style={styles.errorText}>{combinedError}</Text>
              </View>
            ) : null}

            <View style={styles.submitRow}>
              <PrimaryButton label="Create account" icon="checkmark-circle-outline" onPress={handleSignUp}
                disabled={!firstName.trim() || !lastName.trim() || !contactNumber.trim() || !email.trim() || !password || !confirm} loading={loading} />
            </View>

            <View style={styles.switchRow}>
              <Text style={typography.meta}>Already have an account? </Text>
              <Pressable onPress={() => navigation.navigate('Login')}>
                <Text style={styles.link}>Log in</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RolePill({ label, icon, description, active, onPress }: RolePillProps) {
  return (
    <Pressable onPress={onPress} style={[styles.rolePill, active && styles.rolePillActive]}>
      <View style={[styles.rolePillIcon, active && styles.rolePillIconActive]}>
        <Ionicons name={icon} size={20} color={active ? colors.primary : colors.textSecondary} />
      </View>
      {active && <View style={styles.checkmark}><Ionicons name="checkmark" size={13} color="#fff" /></View>}
      <Text style={[styles.rolePillText, active && styles.rolePillTextActive]}>{label}</Text>
      <Text style={styles.rolePillDesc}>{description}</Text>
    </Pressable>
  );
}

function InputField({ icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize, rightIcon, onRightIconPress }: InputFieldProps) {
  return (
    <View style={styles.inputWrap}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor={colors.textMuted}
        value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry}
        keyboardType={keyboardType} autoCapitalize={autoCapitalize || 'none'} autoCorrect={false} />
      {rightIcon ? (
        <Pressable onPress={onRightIconPress} hitSlop={8}>
          <Ionicons name={rightIcon} size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F4F2F1',
  },
  backdropGlow: {
    position: 'absolute',
    top: -120,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(224, 52, 43, 0.12)',
  },
  backdropGlowSecondary: {
    position: 'absolute',
    bottom: -90,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(17, 17, 17, 0.04)',
  },
  headerWrap: { height: 8, zIndex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 32, paddingTop: 4, alignItems: 'center' },
  authCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: '#F0F1F3',
    zIndex: 1,
  },
  kicker: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 30, color: colors.textPrimary, marginTop: 2 },
  sub: { marginTop: 6, marginBottom: 18, lineHeight: 20, fontFamily: 'Inter_400Regular', fontSize: 13.5, color: colors.textSecondary },
  fieldLabel: { marginBottom: 8, color: colors.textPrimary },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  rolePill: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background, gap: 5, position: 'relative' },
  rolePillActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  rolePillIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  rolePillIconActive: { backgroundColor: 'rgba(224,52,43,0.15)' },
  rolePillText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.textSecondary },
  rolePillTextActive: { color: colors.primary },
  rolePillDesc: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textMuted, textAlign: 'center', lineHeight: 15 },
  checkmark: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', gap: 10 },
  nameColumn: { flex: 1 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.primaryLight, borderRadius: 10, padding: 12, marginBottom: 20 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFB', borderRadius: 14, borderWidth: 1.5, borderColor: '#E7E8EB', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14, gap: 10 },
  input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.textPrimary },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(224,52,43,0.08)', borderRadius: 12, padding: 12, marginBottom: 8 },
  errorText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.primary, lineHeight: 18 },
  submitRow: { marginTop: 8, marginBottom: 20 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 10 },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.primary },
});

