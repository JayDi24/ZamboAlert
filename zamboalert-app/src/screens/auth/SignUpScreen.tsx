import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  ScrollView, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image, Alert, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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

type IdPhotoSlotProps = {
  side: 'front' | 'back';
  uri: string;
  onPress: (side: 'front' | 'back') => void;
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

export default function SignUpScreen({ navigation }) {
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
  const [idType, setIdType]           = useState('Barangay ID');
  const [idNumber, setIdNumber]       = useState('');
  const [idFrontUri, setIdFrontUri]   = useState('');
  const [idBackUri, setIdBackUri]     = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [activeSide, setActiveSide] = useState<'front' | 'back' | null>(null);

  const openModal = (side: 'front' | 'back') => {
    setActiveSide(side);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setActiveSide(null);
  };

  const pickIdPhoto = (side: 'front' | 'back') => {
    handleChange();
    openModal(side);
  };

  const capturePhoto = async (side: 'front' | 'back') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to take a photo of your ID.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets[0].base64) {
        const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
        if (side === 'front') setIdFrontUri(base64Uri);
        else setIdBackUri(base64Uri);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const selectFromGallery = async (side: 'front' | 'back') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Gallery permission is required to choose a photo of your ID.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets[0].base64) {
        const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
        if (side === 'front') setIdFrontUri(base64Uri);
        else setIdBackUri(base64Uri);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const combinedError = localError || error;
  function handleChange() { if (localError) setLocalError(''); if (error) clearError(); }

  async function handleSignUp() {
    setLocalError('');
    if (!firstName.trim())    { setLocalError('Please enter your first name.'); return; }
    if (!lastName.trim())     { setLocalError('Please enter your last name.'); return; }
    if (!contactNumber.trim()) { setLocalError('Please enter your contact number.'); return; }
    if (contactNumber.trim().length < 7) { setLocalError('Please enter a valid contact number.'); return; }
    if (role === 'rescuer') {
      if (!idNumber.trim()) { setLocalError('Please enter your ID number.'); return; }
      if (!idFrontUri) { setLocalError('Please upload the front photo of your ID.'); return; }
      if (!idBackUri) { setLocalError('Please upload the back photo of your ID.'); return; }
    }
    if (!email.includes('@')) { setLocalError('Please enter a valid email address.'); return; }
    if (checkPasswordPolicy(password).score < MIN_PASSWORD_SCORE) {
      setLocalError('Password must meet at least 4 of the 5 requirements below.');
      return;
    }
    if (password !== confirm) { setLocalError('Passwords do not match.'); return; }

    const started = await signUp(firstName, lastName, email, password, role, contactNumber, idType, idNumber, idFrontUri, idBackUri);
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <View style={styles.logoRow}>
            <Image
              source={require('../../assets/zamboalert.png')}
              style={styles.logoImage}
            />
            <Text style={typography.appTitle}>ZamboAlert</Text>
          </View>

          <Text style={styles.heading}>Create an account</Text>
          <Text style={[typography.meta, styles.sub]}>
            Tell us who you are so we can route you to the right experience.
          </Text>

          <Text style={[typography.eyebrow, styles.fieldLabel]}>I am a</Text>
          <View style={styles.roleRow}>
            <RolePill label="Citizen" icon="person-outline" description="I need to send an SOS"   active={role === 'citizen'} onPress={() => { setRole('citizen');  handleChange(); }} />
            <RolePill label="Rescuer" icon="shield-outline" description="I respond to emergencies" active={role === 'rescuer'} onPress={() => { setRole('rescuer'); handleChange(); }} />
          </View>

          {role === 'rescuer' && (
            <>
              <Text style={[typography.eyebrow, styles.fieldLabel]}>Select ID Type</Text>
              <View style={styles.idTypeRow}>
                <Pressable
                  style={[styles.idTypePill, idType === 'Barangay ID' && styles.idTypePillActive]}
                  onPress={() => { setIdType('Barangay ID'); handleChange(); }}
                >
                  <Text style={[styles.idTypePillText, idType === 'Barangay ID' && styles.idTypePillTextActive]}>Barangay ID</Text>
                </Pressable>
                <Pressable
                  style={[styles.idTypePill, idType === 'Government ID' && styles.idTypePillActive]}
                  onPress={() => { setIdType('Government ID'); handleChange(); }}
                >
                  <Text style={[styles.idTypePillText, idType === 'Government ID' && styles.idTypePillTextActive]}>Government ID</Text>
                </Pressable>
              </View>

              <Text style={[typography.eyebrow, styles.fieldLabel]}>ID Number</Text>
              <InputField icon="card-outline" placeholder="e.g. BRGY-12345" value={idNumber}
                onChangeText={(t) => { setIdNumber(t); handleChange(); }} />

              <Text style={[typography.eyebrow, styles.fieldLabel]}>Upload ID Photos (Front & Back)</Text>
              <View style={styles.photoSlotsRow}>
                <IdPhotoSlot
                  side="front"
                  uri={idFrontUri}
                  onPress={pickIdPhoto}
                />
                <IdPhotoSlot
                  side="back"
                  uri={idBackUri}
                  onPress={pickIdPhoto}
                />
              </View>
            </>
          )}

          <Text style={[typography.eyebrow, styles.fieldLabel]}>First name</Text>
          <InputField icon="person-outline" placeholder="John" value={firstName}
            onChangeText={(t) => { setFirstName(t); handleChange(); }} autoCapitalize="words" />

          <Text style={[typography.eyebrow, styles.fieldLabel]}>Last name</Text>
          <InputField icon="person-outline" placeholder="Doe" value={lastName}
            onChangeText={(t) => { setLastName(t); handleChange(); }} autoCapitalize="words" />

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
            {loading
              ? <ActivityIndicator color={colors.primary} size="large" />
              : <PrimaryButton label="Create account" icon="checkmark-circle-outline" onPress={handleSignUp}
                  disabled={!firstName.trim() || !lastName.trim() || !contactNumber.trim() || !email.trim() || !password || !confirm} />
            }
          </View>

          <View style={styles.switchRow}>
            <Text style={typography.meta}>Already have an account? </Text>
            <Pressable onPress={() => navigation.navigate('Login')}>
              <Text style={styles.link}>Log in</Text>
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={styles.modalDragIndicator} />
              <Text style={styles.modalTitle}>
                Upload {activeSide === 'front' ? 'Front Side' : 'Back Side'}
              </Text>
              <Text style={styles.modalSubtitle}>
                Select a photo source to upload your ID
              </Text>
            </View>

            <View style={styles.modalOptions}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalOptionBtn,
                  pressed && styles.modalOptionBtnPressed,
                ]}
                onPress={() => {
                  if (activeSide) {
                    capturePhoto(activeSide);
                  }
                  closeModal();
                }}
              >
                <View style={[styles.modalOptionIconWrap, { backgroundColor: '#FEF2F2' }]}>
                  <Ionicons name="camera-outline" size={24} color={colors.primary} />
                </View>
                <View style={styles.modalOptionTextWrap}>
                  <Text style={styles.modalOptionLabel}>Take Photo</Text>
                  <Text style={styles.modalOptionDesc}>Use your camera to snap a picture</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalOptionBtn,
                  pressed && styles.modalOptionBtnPressed,
                ]}
                onPress={() => {
                  if (activeSide) {
                    selectFromGallery(activeSide);
                  }
                  closeModal();
                }}
              >
                <View style={[styles.modalOptionIconWrap, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="images-outline" size={24} color="#15803D" />
                </View>
                <View style={styles.modalOptionTextWrap}>
                  <Text style={styles.modalOptionLabel}>Choose from Gallery</Text>
                  <Text style={styles.modalOptionDesc}>Pick an existing photo from your library</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.modalCancelBtn,
                pressed && styles.modalCancelBtnPressed,
              ]}
              onPress={closeModal}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function IdPhotoSlot({ side, uri, onPress }: IdPhotoSlotProps) {
  const isUploaded = !!uri;
  const label = side === 'front' ? 'Front Side' : 'Back Side';
  const icon: keyof typeof Ionicons.glyphMap = side === 'front' ? 'id-card-outline' : 'card-outline';

  return (
    <Pressable
      onPress={() => onPress(side)}
      style={({ pressed }) => [
        styles.photoSlot,
        isUploaded && styles.photoSlotUploaded,
        pressed && { opacity: 0.8 },
      ]}
    >
      {isUploaded ? (
        <>
          <Image source={{ uri }} style={styles.photoPreview} resizeMode="cover" />
          <View style={styles.photoOverlay}>
            <View style={styles.photoChangeBadge}>
              <Ionicons name="pencil-outline" size={12} color="#fff" />
              <Text style={styles.photoChangeBadgeText}>Change</Text>
            </View>
          </View>
          <View style={styles.photoCheckBadge}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          </View>
        </>
      ) : (
        <View style={styles.photoSlotEmpty}>
          <View style={styles.photoIconWrap}>
            <Ionicons name={icon} size={30} color={colors.primary} />
          </View>
          <Text style={styles.photoSlotLabel}>{label}</Text>
          <Text style={styles.photoSlotHint}>Tap to upload</Text>
          <View style={styles.photoUploadActions}>
            <View style={styles.photoActionChip}>
              <Ionicons name="camera-outline" size={12} color={colors.primary} />
            </View>
            <View style={styles.photoActionDivider} />
            <View style={styles.photoActionChip}>
              <Ionicons name="images-outline" size={12} color={colors.primary} />
            </View>
          </View>
        </View>
      )}
    </Pressable>
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
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  logoChip: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoImage: { width: 32, height: 32, resizeMode: 'contain' },
  heading: { fontFamily: 'Inter_700Bold', fontSize: 26, color: colors.textPrimary },
  sub: { marginTop: 4, marginBottom: 28, lineHeight: 19 },
  fieldLabel: { marginBottom: 8 },
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  rolePill: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, gap: 6, position: 'relative' },
  rolePillActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  rolePillIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.inactiveBg, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  rolePillIconActive: { backgroundColor: 'rgba(224,52,43,0.15)' },
  rolePillText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.textSecondary },
  rolePillTextActive: { color: colors.primary },
  rolePillDesc: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.textMuted, textAlign: 'center', lineHeight: 15 },
  checkmark: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  idTypeRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  idTypePill: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  idTypePillActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  idTypePillText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.textSecondary },
  idTypePillTextActive: { color: colors.primary },
  photoSlotsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  photoSlot: {
    flex: 1,
    height: 140,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    position: 'relative',
  },
  photoSlotUploaded: {
    borderStyle: 'solid',
    borderColor: colors.success,
  },
  photoPreview: { width: '100%', height: '100%' },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 8,
  },
  photoChangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  photoChangeBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: '#fff',
  },
  photoCheckBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 11,
  },
  photoSlotEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 6,
  },
  photoIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  photoSlotLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: colors.textPrimary,
  },
  photoSlotHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: colors.textMuted,
  },
  photoUploadActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  photoActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  photoActionChipText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: colors.primary,
  },
  photoActionDivider: {
    width: 1,
    height: 12,
    backgroundColor: colors.border,
  },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.primaryLight, borderRadius: 10, padding: 12, marginBottom: 20 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16, gap: 10 },
  input: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, color: colors.textPrimary },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(224,52,43,0.08)', borderRadius: 10, padding: 12, marginBottom: 8 },
  errorText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.primary, lineHeight: 18 },
  submitRow: { marginTop: 8, marginBottom: 24 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 16 },
  link: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.primary },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalDragIndicator: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.textSecondary,
  },
  modalOptions: {
    gap: 12,
    marginBottom: 16,
  },
  modalOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalOptionBtnPressed: {
    backgroundColor: colors.inactiveBg,
    borderColor: colors.textSecondary,
  },
  modalOptionIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  modalOptionTextWrap: {
    flex: 1,
  },
  modalOptionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  modalOptionDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  modalCancelBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inactiveBg,
    marginTop: 8,
  },
  modalCancelBtnPressed: {
    opacity: 0.8,
  },
  modalCancelText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: colors.textPrimary,
  },
});
