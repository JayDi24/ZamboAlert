import React from 'react';
import { View, Text } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { Mono, PulsingDot } from '../components/SharedUI';
import { styles } from '../theme/styles';
import { podStatusColors, roleColors } from '../assets/mockData';

export interface PodNode {
  id: string;
  name: string;
  location: string;
  role: string;
  status: string;
  battery: number;
  signal: number;
  hops: number;
}

interface PodsViewProps {
  nodes: PodNode[];
}

export function PodsView({ nodes }: PodsViewProps) {
  const connected = nodes.filter((n) => n.status === 'connected').length;
  const syncing = nodes.filter((n) => n.status === 'syncing').length;
  const offline = nodes.filter((n) => n.status === 'offline').length;

  return (
    <View style={styles.viewContainer}>
      <View style={styles.podsOverviewGrid}>
        {[
          { label: 'ONLINE', value: connected, color: '#000000' },
          { label: 'SYNCING', value: syncing, color: '#dc2626' },
          { label: 'OFFLINE', value: offline, color: '#9ca3af' },
        ].map(({ label, value, color }) => (
          <View key={label} style={styles.podsOverviewCard}>
            <Mono style={[styles.podsOverviewVal, { color }]}>{value}</Mono>
            <Mono style={styles.podsOverviewLabel}>{label}</Mono>
          </View>
        ))}
      </View>

      <View style={styles.listContainer}>
        {nodes.map((node) => {
          const s = podStatusColors[node.status as keyof typeof podStatusColors] || {
            dot: '#9ca3af',
            badgeBg: '#f3f4f6',
            badgeText: '#6b7280',
          };
          const isCriticalBattery = node.battery < 20;

          let batteryBarColor = '#22c55e';
          let batteryTextColor = '#000000';
          if (node.battery < 20) {
            batteryBarColor = '#ef4444';
            batteryTextColor = '#dc2626';
          } else if (node.battery < 50) {
            batteryBarColor = '#eab308';
            batteryTextColor = '#ca8a04';
          }

          let signalBarColor = '#000000';
          if (node.signal <= 40) {
            signalBarColor = '#ef4444';
          } else if (node.signal <= 70) {
            signalBarColor = '#eab308';
          }

          const roleColorsConfig = roleColors[node.role as keyof typeof roleColors] || {
            bg: '#f3f4f6',
            text: '#4b5563',
          };

          return (
            <View
              key={node.id}
              style={[
                styles.podCard,
                node.status === 'offline' ? styles.podCardOffline : null,
              ]}
            >
              <View style={styles.podCardHeader}>
                <View style={styles.podCardLeft}>
                  <PulsingDot color={s.dot} />
                  <View style={styles.podCardMeta}>
                    <Mono style={styles.podCardTitle}>{node.name}</Mono>
                    <Mono style={styles.podCardSubText}>{node.location}</Mono>
                  </View>
                </View>
                <View
                  style={[
                    styles.miniBadge,
                    { backgroundColor: roleColorsConfig.bg, paddingHorizontal: 8 },
                  ]}
                >
                  <Text style={[styles.miniBadgeText, { color: roleColorsConfig.text }]}>
                    {node.role.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.podStatsRow}>
                <View style={styles.podStatCol}>
                  <Text style={styles.podStatLabel}>Battery</Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { backgroundColor: batteryBarColor, width: `${node.battery}%` },
                      ]}
                    />
                  </View>
                  <Mono style={[styles.podStatVal, { color: batteryTextColor }]}>
                    {node.battery}%
                  </Mono>
                </View>

                <View style={styles.podStatCol}>
                  <Text style={styles.podStatLabel}>Signal</Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { backgroundColor: signalBarColor, width: `${node.signal}%` },
                      ]}
                    />
                  </View>
                  <Mono style={styles.podStatVal}>{node.signal}%</Mono>
                </View>

                <View style={styles.podStatCol}>
                  <Text style={styles.podStatLabel}>Hops</Text>
                  <Mono style={styles.hopsVal}>{node.hops}</Mono>
                </View>
              </View>

              {isCriticalBattery && (
                <View style={styles.podAlertBanner}>
                  <AlertTriangle size={12} color="#dc2626" />
                  <Mono style={styles.podAlertText}>Critical battery — replace pod soon</Mono>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
