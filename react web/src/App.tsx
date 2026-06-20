import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
} from "react-native";

type SOSStatus = "UNASSIGNED" | "ASSIGNED" | "RESOLVED";

type SOSAlert = {
  id: string;
  name: string;
  zone: string;
  method: string;
  status: SOSStatus;
  battery: number;
  time: string;
  message?: string;
  assignedTo?: string;
};

type Rescuer = {
  id: string;
  name: string;
  status: "AVAILABLE" | "EN ROUTE" | "ON SCENE";
  unit: string;
  lastPing: string;
  battery: number;
};

const INITIAL_ALERTS: SOSAlert[] = [
  {
    id: "A-03",
    name: "Barangay San Roque",
    zone: "Zone 1",
    method: "GPS",
    status: "UNASSIGNED",
    battery: 82,
    time: "08:22",
    message: "Medical emergency reported near market.",
  },
  {
    id: "A-07",
    name: "Carmen Heights",
    zone: "Zone 4",
    method: "BT-Mesh",
    status: "ASSIGNED",
    battery: 61,
    time: "08:18",
    assignedTo: "R-02",
  },
  {
    id: "A-12",
    name: "Iligan Junction",
    zone: "Zone 2",
    method: "GPS",
    status: "RESOLVED",
    battery: 96,
    time: "08:05",
  },
];

const RESCUERS: Rescuer[] = [
  { id: "R-01", name: "Alpha Team", status: "AVAILABLE", unit: "Brgy. Patrol", lastPing: "2m ago", battery: 87 },
  { id: "R-02", name: "Bravo Unit", status: "EN ROUTE", unit: "Rescue Squad", lastPing: "1m ago", battery: 73 },
  { id: "R-03", name: "Charlie", status: "ON SCENE", unit: "Medical", lastPing: "45s ago", battery: 65 },
];

const STATUS_COLOR: Record<SOSStatus | Rescuer["status"], string> = {
  UNASSIGNED: "#dc2626",
  ASSIGNED: "#f97316",
  RESOLVED: "#38bdf8",
  AVAILABLE: "#22c55e",
  "EN ROUTE": "#f97316",
  "ON SCENE": "#ef4444",
};

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function StatusBadge({ status }: { status: SOSStatus }) {
  return (
    <View style={[styles.badge, { backgroundColor: STATUS_COLOR[status] }]}> 
      <Text style={styles.badgeText}>{status}</Text>
    </View>
  );
}

function RescuerBadge({ status }: { status: Rescuer["status"] }) {
  return (
    <View style={[styles.smallBadge, { backgroundColor: `${STATUS_COLOR[status]}22`, borderColor: `${STATUS_COLOR[status]}55` }]}> 
      <Text style={[styles.smallBadgeText, { color: STATUS_COLOR[status] }]}>{status}</Text>
    </View>
  );
}

function Dot({ active }: { active: boolean }) {
  return (
    <View style={[styles.dot, active ? styles.dotActive : styles.dotInactive]} />
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-PH", { hour12: false });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-PH", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

function AlertCard({ alert }: { alert: SOSAlert }) {
  return (
    <View style={styles.alertCard}>
      <View style={styles.alertHeader}>
        <Text style={styles.alertName}>{alert.name}</Text>
        <Text style={styles.alertMethod}>{alert.method}</Text>
      </View>
      <View style={styles.alertRow}>
        <View>
          <Text style={styles.alertTime}>{alert.time}</Text>
          <Text style={styles.alertMeta}>SOS {alert.id}</Text>
        </View>
        <StatusBadge status={alert.status} />
      </View>
      <View style={styles.progressBarBackground}>
        <View style={[styles.progressBarFill, { width: `${alert.battery}%`, backgroundColor: STATUS_COLOR[alert.status] }]} />
      </View>
      <Text style={styles.alertBattery}>{alert.battery}% battery</Text>
    </View>
  );
}

function MapWidget() {
  return (
    <View style={styles.mapCard}>
      <View style={styles.mapGradient}>
        <View style={[styles.mapMarker, { top: "20%", left: "35%" }]}>
          <Text style={styles.mapMarkerText}>SOS</Text>
        </View>
        <View style={[styles.mapMarkerSmall, { top: "55%", left: "63%" }]} />
        <View style={[styles.mapMarkerSmall, { top: "70%", left: "28%" }]} />
        <Text style={styles.mapHint}>Map overlay placeholder</Text>
      </View>
    </View>
  );
}

export default function App() {
  const now = useNow();
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [activeTab, setActiveTab] = useState<"alerts" | "rescuers" | "network">("alerts");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [dispatchTarget, setDispatchTarget] = useState<SOSAlert | null>(null);
  const [callRescuerOpen, setCallRescuerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [lastAction, setLastAction] = useState("Awaiting operator action.");

  const unassignedAlerts = alerts.filter((alert) => alert.status === "UNASSIGNED");

  const stats = useMemo(
    () => ({
      active: alerts.filter((alert) => alert.status !== "RESOLVED").length,
      rescuers: RESCUERS.length,
      nodes: 12,
      unassigned: unassignedAlerts.length,
    }),
    [alerts, unassignedAlerts.length]
  );

  const handleDispatch = (alertId: string, rescuerId: string) => {
    const alert = alerts.find((item) => item.id === alertId);
    const rescuer = RESCUERS.find((item) => item.id === rescuerId);
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId ? { ...alert, status: "ASSIGNED", assignedTo: rescuerId } : alert
      )
    );
    setLastAction(`${rescuer?.name ?? rescuerId} dispatched to ${alert?.name ?? alertId}.`);
    setDispatchTarget(null);
  };

  const handleResolve = (alertId: string) => {
    setAlerts((prev) => prev.map((alert) => (alert.id === alertId ? { ...alert, status: "RESOLVED" } : alert)));
    setLastAction(`${alertId} marked resolved.`);
    setDispatchTarget(null);
  };

  const handleBroadcast = () => {
    if (!broadcastReady) return;
    setLastAction(`Broadcast transmitted: "${message.trim()}"`);
    setMessage("");
    setBroadcastOpen(false);
  };

  const handleCallRescuer = (rescuer: Rescuer) => {
    setLastAction(`Calling ${rescuer.name} on ${rescuer.unit}.`);
    setCallRescuerOpen(false);
  };

  const broadcastReady = message.trim().length > 0;

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brandTitle}>ZamboAlert</Text>
            <Text style={styles.brandSubtitle}>Barangay SOS Monitoring</Text>
          </View>
          <View style={styles.topStatusRow}>
            <View style={styles.statusChip}>
              <Dot active />
              <Text style={styles.statusText}>GATEWAY ONLINE</Text>
            </View>
            <View style={styles.dateBlock}>
              <Text style={styles.currentTime}>{formatTime(now)}</Text>
              <Text style={styles.currentDate}>{formatDate(now)}</Text>
            </View>
            <TouchableOpacity style={styles.broadcastButton} onPress={() => setBroadcastOpen(true)}>
              <Text style={styles.broadcastButtonText}>Broadcast</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.dashboardRow}>
          <View style={styles.leftPane}>
            <View style={styles.statsGrid}>
              {[
                { label: "Active SOS", value: stats.active, color: "#dc2626" },
                { label: "Rescuers", value: stats.rescuers, color: "#ef4444" },
                { label: "Mesh Nodes", value: stats.nodes, color: "#fb7185" },
              ].map((item) => (
                <View key={item.label} style={styles.statCard}>
                  <Text style={[styles.statValue, { color: item.color }]}>{item.value}</Text>
                  <Text style={styles.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.tabBar}>
              {[
                { key: "alerts", label: "SOS Alerts" },
                { key: "rescuers", label: "Rescuers" },
                { key: "network", label: "Network" },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key as typeof activeTab)}
                  style={[styles.tabItem, activeTab === tab.key && styles.tabActive]}
                >
                  <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.tabPanel}>
              {activeTab === "alerts" && (
                <View>
                  {alerts.map((alert) => (
                    <TouchableOpacity
                      key={alert.id}
                      onPress={() =>
                        alert.status === "RESOLVED"
                          ? setLastAction(`${alert.id} is already resolved.`)
                          : setDispatchTarget(alert)
                      }
                      style={styles.alertListItem}
                    >
                      <View style={styles.alertListHeader}>
                        <Text style={styles.alertListId}>{alert.id}</Text>
                        <StatusBadge status={alert.status} />
                      </View>
                      <Text style={styles.alertListName}>{alert.name}</Text>
                      <Text style={styles.alertListMeta}>{alert.zone} · {alert.method}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {activeTab === "rescuers" && (
                <View>
                  {RESCUERS.map((rescuer) => (
                    <View key={rescuer.id} style={styles.rescuerItem}>
                      <View style={styles.alertListHeader}>
                        <Text style={styles.alertListId}>{rescuer.id}</Text>
                        <RescuerBadge status={rescuer.status} />
                      </View>
                      <Text style={styles.alertListName}>{rescuer.name}</Text>
                      <Text style={styles.alertListMeta}>{rescuer.unit}</Text>
                      <Text style={styles.alertListMeta}>{rescuer.lastPing} · BAT {rescuer.battery}%</Text>
                    </View>
                  ))}
                </View>
              )}

              {activeTab === "network" && (
                <View>
                  <View style={styles.networkLine}>
                    <Text style={styles.networkLabel}>Wi-Fi AP</Text>
                    <Text style={styles.networkValue}>ACTIVE</Text>
                  </View>
                  <View style={styles.networkLine}>
                    <Text style={styles.networkLabel}>BT Mesh</Text>
                    <Text style={styles.networkValue}>12 NODES</Text>
                  </View>
                  <View style={styles.networkLine}>
                    <Text style={styles.networkLabel}>Internet</Text>
                    <Text style={styles.networkDown}>BLACKOUT</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          <View style={styles.mainPane}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>Tactical Map</Text>
              <Text style={styles.sectionHeaderBadge}>LIVE</Text>
            </View>
            <MapWidget />
            <View style={styles.statusBar}>
              <Text style={styles.statusBarText}>SYSTEM NOMINAL</Text>
              <Text style={styles.statusBarText}>LOCAL AP MODE</Text>
              <Text style={styles.statusBarAccent}>BATTERY BACKUP ACTIVE</Text>
              <Text style={styles.statusBarText}>UPTIME 04:32:17</Text>
            </View>
          </View>

          <View style={styles.rightPane}>
            <View style={styles.quickActionsHeader}>
              <Text style={styles.quickActionsTitle}>Quick Actions</Text>
            </View>
            <View style={styles.quickActionsGrid}>
              <TouchableOpacity style={styles.actionButton} onPress={() => setBroadcastOpen(true)}>
                <Text style={styles.actionButtonText}>Broadcast Alert</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={() => {
                  const next = alerts.find((alert) => alert.status === "UNASSIGNED");
                  if (next) {
                    setDispatchTarget(next);
                  } else {
                    setLastAction("No unassigned SOS alerts in the queue.");
                  }
                }}
              >
                <Text style={[styles.actionButtonText, styles.actionButtonPrimaryText]}>Dispatch Next SOS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonOutline]}
                onPress={() => setCallRescuerOpen(true)}
              >
                <Text style={styles.actionButtonOutlineText}>Call Rescuer</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.activityBox}>
              <Text style={styles.activityLabel}>Latest Activity</Text>
              <Text style={styles.activityText}>{lastAction}</Text>
            </View>

            <View style={styles.unassignedBox}>
              <Text style={styles.unassignedTitle}>Unassigned SOS</Text>
              {unassignedAlerts.length === 0 ? (
                <Text style={styles.unassignedEmpty}>All alerts are assigned.</Text>
              ) : (
                unassignedAlerts.map((alert) => (
                  <View key={alert.id} style={styles.unassignedItem}>
                    <View style={styles.alertListHeader}>
                      <Text style={styles.alertListId}>{alert.id}</Text>
                      <StatusBadge status={alert.status} />
                    </View>
                    <Text style={styles.alertListName}>{alert.name}</Text>
                    <Text style={styles.alertListMeta}>{alert.zone}</Text>
                    <TouchableOpacity style={styles.dispatchButton} onPress={() => setDispatchTarget(alert)}>
                      <Text style={styles.dispatchButtonText}>Dispatch</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={broadcastOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Broadcast Announcement</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Enter broadcast message..."
              placeholderTextColor="#9ca3af"
              multiline
              style={styles.modalInput}
            />
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setBroadcastOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, !broadcastReady && styles.modalSubmitDisabled]}
                disabled={!broadcastReady}
                onPress={handleBroadcast}
              >
                <Text style={styles.modalSubmitText}>Transmit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(dispatchTarget)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Dispatch Rescue Unit</Text>
            <Text style={styles.modalDescription}>Select a unit for {dispatchTarget?.name}.</Text>
            {RESCUERS.map((rescuer) => (
              <TouchableOpacity
                key={rescuer.id}
                style={styles.dispatchUnit}
                onPress={() => dispatchTarget && handleDispatch(dispatchTarget.id, rescuer.id)}
              >
                <Text style={styles.dispatchUnitName}>{rescuer.name}</Text>
                <Text style={styles.dispatchUnitMeta}>{rescuer.unit} · {rescuer.id}</Text>
              </TouchableOpacity>
            ))}
            {dispatchTarget?.status !== "RESOLVED" && (
              <TouchableOpacity style={styles.resolveButton} onPress={() => dispatchTarget && handleResolve(dispatchTarget.id)}>
                <Text style={styles.resolveButtonText}>Mark Resolved</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setDispatchTarget(null)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={callRescuerOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Call Rescuer</Text>
            <Text style={styles.modalDescription}>Select an active responder to call.</Text>
            {RESCUERS.map((rescuer) => (
              <TouchableOpacity
                key={rescuer.id}
                style={styles.dispatchUnit}
                onPress={() => handleCallRescuer(rescuer)}
              >
                <Text style={styles.dispatchUnitName}>{rescuer.name}</Text>
                <Text style={styles.dispatchUnitMeta}>{rescuer.unit} / {rescuer.status}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setCallRescuerOpen(false)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
  },
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  topBar: {
    marginBottom: 20,
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  brandTitle: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "800",
  },
  brandSubtitle: {
    color: "#94a3b8",
    marginTop: 6,
    fontSize: 13,
  },
  topStatusRow: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  statusText: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "700",
  },
  dateBlock: {
    alignItems: "flex-end",
  },
  currentTime: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
  },
  currentDate: {
    color: "#94a3b8",
    fontSize: 11,
  },
  broadcastButton: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 18,
  },
  broadcastButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  dashboardRow: {
    flexDirection: "row",
    gap: 20,
    minHeight: 680,
  },
  leftPane: {
    width: 320,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  statCard: {
    width: 96,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
  },
  statLabel: {
    marginTop: 6,
    color: "#6b7280",
    fontSize: 10,
    textAlign: "center",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 18,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRightWidth: 1,
    borderColor: "#e5e7eb",
  },
  tabActive: {
    backgroundColor: "#fef2f2",
  },
  tabText: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  tabTextActive: {
    color: "#b91c1c",
  },
  tabPanel: {
    minHeight: 420,
  },
  alertListItem: {
    backgroundColor: "#fff7f7",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fee2e2",
  },
  alertListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  alertListId: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
  },
  alertListName: {
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "700",
  },
  alertListMeta: {
    color: "#9ca3af",
    fontSize: 11,
    marginTop: 4,
  },
  rescuerItem: {
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  networkLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
  },
  networkLabel: {
    color: "#6b7280",
    fontSize: 11,
  },
  networkValue: {
    color: "#b91c1c",
    fontSize: 11,
    fontWeight: "700",
  },
  networkDown: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "700",
    textDecorationLine: "line-through",
  },
  mainPane: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
  },
  sectionHeaderBadge: {
    backgroundColor: "#fee2e2",
    color: "#b91c1c",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: "700",
  },
  mapCard: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "#030712",
    minHeight: 520,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#181c2b",
  },
  mapGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 24,
    padding: 16,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
  },
  mapMarker: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "#dc2626",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  mapMarkerSmall: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: "#f97316",
  },
  mapMarkerText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  mapHint: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 16,
  },
  statusBar: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#fff1f2",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statusBarText: {
    color: "#7f1d1d",
    fontSize: 11,
    fontWeight: "700",
  },
  statusBarAccent: {
    color: "#b91c1c",
    fontSize: 11,
    fontWeight: "800",
  },
  rightPane: {
    width: 300,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  quickActionsHeader: {
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
    paddingBottom: 12,
    marginBottom: 14,
  },
  quickActionsTitle: {
    color: "#b91c1c",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  quickActionsGrid: {
    gap: 12,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    backgroundColor: "#fff7f7",
    alignItems: "center",
    marginBottom: 10,
  },
  actionButtonPrimary: {
    backgroundColor: "#dc2626",
    borderColor: "#dc2626",
  },
  actionButtonText: {
    color: "#b91c1c",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  actionButtonPrimaryText: {
    color: "#fff",
  },
  actionButtonOutline: {
    backgroundColor: "#ffffff",
    borderColor: "#dc2626",
  },
  actionButtonOutlineText: {
    color: "#b91c1c",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  activityBox: {
    marginTop: 2,
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  activityLabel: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  activityText: {
    color: "#111827",
    fontSize: 12,
    lineHeight: 18,
  },
  unassignedBox: {
    marginTop: 10,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#fff7f7",
    borderWidth: 1,
    borderColor: "#fee2e2",
  },
  unassignedTitle: {
    color: "#991b1b",
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  unassignedEmpty: {
    color: "#9ca3af",
    fontSize: 12,
  },
  unassignedItem: {
    borderRadius: 18,
    backgroundColor: "#fff",
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fee2e2",
  },
  dispatchButton: {
    marginTop: 12,
    backgroundColor: "#dc2626",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  dispatchButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 24,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  modalTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 14,
  },
  modalDescription: {
    color: "#6b7280",
    fontSize: 13,
    marginBottom: 18,
  },
  modalInput: {
    minHeight: 120,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    color: "#111827",
    backgroundColor: "#f8fafc",
    marginBottom: 18,
    textAlignVertical: "top",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalCancel: {
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  modalCancelText: {
    color: "#6b7280",
    fontWeight: "700",
  },
  modalSubmit: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 18,
    backgroundColor: "#dc2626",
  },
  modalSubmitDisabled: {
    backgroundColor: "#fca5a5",
  },
  modalSubmitText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  dispatchUnit: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    padding: 16,
    marginBottom: 10,
  },
  dispatchUnitName: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  dispatchUnitMeta: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 4,
  },
  resolveButton: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#38bdf8",
    backgroundColor: "#f0f9ff",
    paddingVertical: 14,
    alignItems: "center",
  },
  resolveButtonText: {
    color: "#0369a1",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  badge: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  smallBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  smallBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  alertCard: {
    minWidth: 240,
    borderRadius: 20,
    padding: 18,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  alertHeader: {
    marginBottom: 12,
  },
  alertName: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  alertMethod: {
    color: "#94a3b8",
    fontSize: 11,
  },
  alertRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  alertTime: {
    color: "#38bdf8",
    fontSize: 32,
    fontWeight: "800",
  },
  alertMeta: {
    color: "#94a3b8",
    fontSize: 10,
    marginTop: 4,
  },
  progressBarBackground: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginTop: 12,
  },
  progressBarFill: {
    height: 8,
    borderRadius: 999,
  },
  alertBattery: {
    color: "#94a3b8",
    fontSize: 10,
    marginTop: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  dotActive: {
    backgroundColor: "#dc2626",
  },
  dotInactive: {
    backgroundColor: "#6b7280",
  },
});
