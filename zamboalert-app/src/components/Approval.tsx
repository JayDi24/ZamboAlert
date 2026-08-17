import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography, fontFamily } from '../theme/typography';

export type WaitingForApprovalModalProps = {
  visible: boolean;
  onClose: () => void;
  rescuerName?: string;
  rescuerEmail?: string;
  idType?: string;
  idNumber?: string;
  submittedAt?: string;
  onCheckStatus?: () => Promise<boolean | void>;
};

export default function WaitingForApprovalModal({
  visible,
  onClose,
  rescuerName = 'Rescuer Applicant',
  rescuerEmail,
  idType = 'Barangay / Government ID',
  idNumber = 'Under Review',
  submittedAt,
  onCheckStatus,
}: WaitingForApprovalModalProps) {
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  
  // Pulse animation for the waiting icon
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [visible, pulseAnim]);

  const handleCheckStatus = async () => {
    setChecking(true);
    setStatusMessage(null);
    try {
      if (onCheckStatus) {
        const isApproved = await onCheckStatus();
        if (isApproved) {
          Alert.alert(
            'Account Approved! 🎉',
            'Your rescuer credentials have been verified by ZamboAlert Admin. You can now log in.',
            [{ text: 'Proceed to Login', onPress: onClose }]
          );
          return;
        }
      } else {
        // Simulated latency
        await new Promise((res) => setTimeout(res, 1200));
      }
      setStatusMessage('Still pending review. The ZamboAlert Admin Web team is verifying your submitted ID.');
    } catch {
      setStatusMessage('Unable to connect. Please check your internet connection.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.badgeWrap}>
            <View style={styles.pendingBadgeDot} />
            <Text style={styles.pendingBadgeText}>PENDING APPROVAL</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Animated Hero Header */}
          <View style={styles.heroSection}>
            <Animated.View
              style={[
                styles.pulseRing,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="hourglass-outline" size={44} color="#D97706" />
              </View>
            </Animated.View>
            <Text style={styles.title}>Waiting for Approval</Text>
            <Text style={styles.subtitle}>
              Your rescuer registration has been submitted and is currently in the{' '}
              <Text style={{ fontFamily: fontFamily.semibold, color: colors.textPrimary }}>
                ZamboAlert Admin Web
              </Text>{' '}
              verification queue.
            </Text>
          </View>

          {/* User & Submission Card */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Submitted Credentials</Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Applicant Name</Text>
              <Text style={styles.infoValue} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>{rescuerName}</Text>
            </View>

            {rescuerEmail ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Account Email</Text>
                <Text style={styles.infoValue} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>{rescuerEmail}</Text>
              </View>
            ) : null}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ID Type</Text>
              <Text style={styles.infoValue} numberOfLines={2}>{idType}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ID Number</Text>
              <Text style={styles.infoValue} numberOfLines={2}>{idNumber || 'Submitted'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Verification Status</Text>
              <View style={styles.statusPill}>
                <View style={styles.statusDotAmber} />
                <Text style={styles.statusPillText}>Under Admin Review</Text>
              </View>
            </View>
          </View>

          {/* Review Timeline */}
          <View style={styles.timelineSection}>
            <Text style={styles.sectionTitle}>Verification Process</Text>

            <View style={styles.timelineItem}>
              <View style={styles.timelineIconActive}>
                <Ionicons name="checkmark" size={14} color="#FFF" />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Registration Completed</Text>
                <Text style={styles.timelineSub}>Account and contact details saved</Text>
              </View>
            </View>

            <View style={styles.timelineLineActive} />

            <View style={styles.timelineItem}>
              <View style={styles.timelineIconActive}>
                <Ionicons name="checkmark" size={14} color="#FFF" />
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>ID Credentials Uploaded</Text>
                <Text style={styles.timelineSub}>Front and back ID photos captured</Text>
              </View>
            </View>

            <View style={styles.timelineLinePending} />

            <View style={styles.timelineItem}>
              <View style={styles.timelineIconPending}>
                <Ionicons name="eye-outline" size={16} color="#D97706" />
              </View>
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, { color: '#D97706' }]}>
                  ZamboAlert Admin Verification
                </Text>
                <Text style={styles.timelineSub}>
                  Admin web officials check your ID photo to confirm legit rescuer status
                </Text>
              </View>
            </View>

            <View style={styles.timelineLineGray} />

            <View style={styles.timelineItem}>
              <View style={styles.timelineIconGray}>
                <Ionicons name="key-outline" size={14} color={colors.textMuted} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, { color: colors.textMuted }]}>
                  Rescuer Dashboard Access
                </Text>
                <Text style={styles.timelineSub}>
                  Full access granted upon admin approval
                </Text>
              </View>
            </View>
          </View>

          {/* Notice Box */}
          <View style={styles.noticeBox}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.noticeText}>
              Why is this required? ZamboAlert strictly verifies all rescuer credentials to ensure that only legitimate officials handle emergency responses and access victim data.
            </Text>
          </View>

          {statusMessage ? (
            <View style={styles.statusMessageCard}>
              <Ionicons name="time-outline" size={16} color="#D97706" />
              <Text style={styles.statusMessageText}>{statusMessage}</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Footer Controls */}
        <View style={styles.footer}>
          <Pressable
            onPress={handleCheckStatus}
            disabled={checking}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.9 },
            ]}
          >
            {checking ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={18} color="#FFF" />
                <Text style={styles.primaryBtnText}>Check Approval Status</Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.secondaryBtnText}>Return to Login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  pendingBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D97706',
  },
  pendingBadgeText: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    color: '#92400E',
    letterSpacing: 0.5,
  },
  scroll: {
    padding: 24,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  pulseRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 12,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  infoLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  infoValue: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDotAmber: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
  },
  statusPillText: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#B45309',
  },
  timelineSection: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineIconActive: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineIconPending: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineIconGray: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.inactiveBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  timelineSub: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  timelineLineActive: {
    width: 2,
    height: 20,
    backgroundColor: colors.success,
    marginLeft: 12,
    marginVertical: 4,
  },
  timelineLinePending: {
    width: 2,
    height: 20,
    backgroundColor: '#FDE68A',
    marginLeft: 12,
    marginVertical: 4,
  },
  timelineLineGray: {
    width: 2,
    height: 20,
    backgroundColor: colors.border,
    marginLeft: 12,
    marginVertical: 4,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.primaryLight,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  noticeText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  statusMessageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  statusMessageText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 12,
    color: '#92400E',
  },
  footer: {
    padding: 20,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: '#FFF',
  },
  secondaryBtn: {
    height: 44,
    backgroundColor: colors.background,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.textPrimary,
  },
});
