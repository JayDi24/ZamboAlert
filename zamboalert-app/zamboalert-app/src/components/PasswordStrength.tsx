// src/components/PasswordStrength.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { checkPasswordPolicy } from '../context/AuthContext';

const LABEL_COLORS: Record<string, string> = {
  Weak: colors.statusCritical,
  Fair: '#f97316',
  Good: '#eab308',
  Strong: colors.success,
  Excellent: colors.success,
};

export default function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const { requirements, score, label } = checkPasswordPolicy(password);
  const barColor = LABEL_COLORS[label] || colors.textMuted;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[typography.meta, styles.rowLabel]}>Password strength</Text>
        <Text style={[styles.rowValue, { color: barColor }]}>{label} ({score}/5)</Text>
      </View>
      <View style={styles.barOuter}>
        <View style={[styles.barInner, { width: `${(score / 5) * 100}%`, backgroundColor: barColor }]} />
      </View>
      <View style={styles.checklist}>
        <Req met={requirements.length} label="At least 8 characters" />
        <Req met={requirements.uppercase} label="One uppercase letter" />
        <Req met={requirements.lowercase} label="One lowercase letter" />
        <Req met={requirements.number} label="One number" />
        <Req met={requirements.special} label="One special character" />
      </View>
    </View>
  );
}

function Req({ met, label }: { met: boolean; label: string }) {
  return (
    <View style={styles.reqRow}>
      <Ionicons name={met ? 'checkmark-circle' : 'ellipse-outline'} size={13} color={met ? colors.success : colors.textMuted} />
      <Text style={[styles.reqText, { color: met ? colors.textSecondary : colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.inactiveBg, borderRadius: 10, padding: 12, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rowLabel: {},
  rowValue: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  barOuter: { height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden', marginBottom: 10 },
  barInner: { height: '100%', borderRadius: 3 },
  checklist: { gap: 5 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reqText: { fontFamily: 'Inter_400Regular', fontSize: 11.5 },
});
