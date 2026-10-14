import React from 'react';
import { View, Text } from 'react-native';
import { Mono, PulsingDot } from '../components/SharedUI';
import { styles } from '../theme/styles';

export interface PodNode {
  id: string;
  rssi: number;
  snr: number;
  hops: number;
  receivedAt: string;
  hasGpsFix: boolean;
}

interface PodsViewProps {
  nodes: PodNode[];
}

export function PodsView({ nodes }: PodsViewProps) {
  return (
    <View style={styles.viewContainer}>
      <View style={styles.podsOverviewGrid}>
        <View style={styles.podsOverviewCard}>
          <Mono style={[styles.podsOverviewVal, { color: '#000000' }]}>{nodes.length}</Mono>
          <Mono style={styles.podsOverviewLabel}>RECENT PODS</Mono>
        </View>
      </View>

      <View style={styles.listContainer}>
        {nodes.length === 0 ? (
          <View style={styles.podCard}>
            <Text style={styles.podCardSubText}>No recent pod telemetry received from the gateway.</Text>
          </View>
        ) : nodes.map((node) => (
            <View
              key={node.id}
              style={styles.podCard}
            >
              <View style={styles.podCardHeader}>
                <View style={styles.podCardLeft}>
                  <PulsingDot color="#22c55e" />
                  <View style={styles.podCardMeta}>
                    <Mono style={styles.podCardTitle}>POD {node.id}</Mono>
                    <Mono style={styles.podCardSubText}>
                      {new Date(node.receivedAt).toLocaleTimeString()} · {node.hasGpsFix ? 'GPS fix' : 'No GPS fix'}
                    </Mono>
                  </View>
                </View>
                <Text style={styles.miniBadgeText}>RECENT</Text>
              </View>

              <View style={styles.podStatsRow}>
                <View style={styles.podStatCol}>
                  <Text style={styles.podStatLabel}>LoRa RSSI</Text>
                  <Mono style={styles.podStatVal}>{node.rssi} dBm</Mono>
                </View>
                <View style={styles.podStatCol}>
                  <Text style={styles.podStatLabel}>SNR</Text>
                  <Mono style={styles.podStatVal}>{node.snr.toFixed(1)} dB</Mono>
                </View>
                <View style={styles.podStatCol}>
                  <Text style={styles.podStatLabel}>Hops</Text>
                  <Mono style={styles.hopsVal}>{node.hops}</Mono>
                </View>
              </View>

            </View>
          ))}
      </View>
    </View>
  );
}
