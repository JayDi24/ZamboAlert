// src/components/PasswordStrength.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { checkPasswordPolicy } from '../context/AuthContext';

const LABEL_COLORS: Record<string, string> = {
  Weak: '#EF4444',
  Fair: '#F97316',
  Good: '#EAB308',
  Strong: '#10B981',
  Excellent: '#059669',
};

export default function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const { requirements, score, label } = checkPasswordPolicy(password);
  const barColor = LABEL_COLORS[label] || colors.textMuted;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.titleWithIcon}>
          <Ionicons name="shield-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>Security strength</Text>
        </View>
        <Text style={[styles.rowValue, { color: barColor }]}>{label} ({score}/5)</Text>
      </View>
      <View style={styles.barOuter}>
        <View style={[styles.barInner, { width: `${Math.max(8, (score / 5) * 100)}%`, backgroundColor: barColor }]} />
      </View>
      <View style={styles.checklist}>
        <Req met={requirements.length} label="8+ characters" />
        <Req met={requirements.uppercase} label="Uppercase letter (A-Z)" />
        <Req met={requirements.lowercase} label="Lowercase letter (a-z)" />
        <Req met={requirements.number} label="At least one number (0-9)" />
        <Req met={requirements.special} label="Special character (!@#$)" />
      </View>
    </View>
  );
}

function Req({ met, label }: { met: boolean; label: string }) {
  return (
    <View style={styles.reqRow}>
      <Ionicons
        name={met ? 'checkmark-circle' : 'ellipse-outline'}
        size={13}
        color={met ? '#10B981' : '#9CA3AF'}
      />
      <Text style={[styles.reqText, met && styles.reqTextMet]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  rowValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11.5,
  },
  barOuter: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 10,
  },
  barInner: {
    height: '100%',
    borderRadius: 2,
  },
  checklist: {
    gap: 4,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reqText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11.5,
    color: '#6B7280',
  },
  reqTextMet: {
    color: '#1F2937',
    fontFamily: 'Inter_500Medium',
  },
});
