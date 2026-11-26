import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { User, LogOut, Clock, RefreshCw, Key, ShieldAlert, Smartphone } from 'lucide-react-native';
import { styles, settingsStyles } from '../screens/Auth.styles';
import { UserRecord, SessionDetails } from '../utils/authData';
import { InputField } from './FormElements';

// ── SessionSettingsSection Component ─────────────────────────────────────────
// Displays the rescuer account summary and session details.
interface SessionSettingsProps {
  // The app's PublicUser carries `name`; UserRecord's `username` is never set.
  currentUser: UserRecord & { name?: string };
  session: SessionDetails;
  onLogout: () => void;
}

export function SessionSettingsSection({
  currentUser,
  session,
  onLogout,
}: SessionSettingsProps) {
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState<number>(0);

  // Track session countdown
  useEffect(() => {
    const updateTime = () => {
      const remaining = Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000));
      setSessionTimeRemaining(remaining);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <View style={settingsStyles.container}>
      <Text style={settingsStyles.sectionTitle}>SECURITY SETTINGS</Text>

      {/* Account Profile Summary */}
      <View style={settingsStyles.card}>
        <Text style={settingsStyles.cardHeader}>Rescuer Account</Text>
        <View style={settingsStyles.row}>
          <Text style={settingsStyles.label}>Username:</Text>
          <Text style={settingsStyles.value}>{currentUser.name || currentUser.email}</Text>
        </View>
        <View style={settingsStyles.row}>
          <Text style={settingsStyles.label}>Email:</Text>
          <Text style={settingsStyles.value}>{currentUser.email}</Text>
        </View>
        <View style={settingsStyles.row}>
          <Text style={settingsStyles.label}>Contact:</Text>
          <Text style={settingsStyles.value}>{(currentUser as any).contactNumber || 'N/A'}</Text>
        </View>
        <View style={settingsStyles.row}>
          <Text style={settingsStyles.label}>Status:</Text>
          <Text style={[settingsStyles.value, { color: "#10b981", fontWeight: "bold" }]}>
            VERIFIED RESCUER
          </Text>
        </View>
      </View>

      {/* Log Out Button */}
      <TouchableOpacity onPress={onLogout} style={settingsStyles.logoutBtn}>
        <LogOut size={16} color="#ffffff" style={{ marginRight: 8 }} />
        <Text style={settingsStyles.logoutBtnText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── SessionTimeoutOverlay Component ──────────────────────────────────────────
// Renders when inactivity timeout is about to trigger, offering an extend button.
interface SessionTimeoutOverlayProps {
  expiresAt: number;
  onRenew: () => void;
  onExpire: () => void;
}

export function SessionTimeoutOverlay({
  expiresAt,
  onRenew,
  onExpire,
}: SessionTimeoutOverlayProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const checkTime = () => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        onExpire();
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Only show when under 30 seconds
  if (timeLeft > 30 || timeLeft <= 0) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.alertCard}>
        <Clock size={28} color="#f59e0b" style={{ marginBottom: 12 }} />
        <Text style={styles.alertTitle}>Session Inactivity Warning</Text>
        <Text style={styles.alertDesc}>
          Due to inactivity, your secure session will expire and automatically log out in:
        </Text>
        <Text style={styles.alertTimer}>{timeLeft} seconds</Text>

        <TouchableOpacity onPress={onRenew} style={styles.renewBtn}>
          <Text style={styles.renewBtnText}>Keep Session Active</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}