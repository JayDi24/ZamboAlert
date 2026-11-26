// src/context/AppStateContext.tsx
import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import * as Location from 'expo-location';
const BLEAdvertiser = require('react-native-ble-advertiser') as typeof import('react-native-ble-advertiser');

import { API_BASE_URL } from '../config';
import { useAuth } from './AuthContext';

const SOS_SERVICE_UUID = 'fef10001-7b82-4b93-b2c2-0f81ea3300a1';
// Server keeps an SOS for 10 min after its last POST; re-send well inside that.
const SOS_HEARTBEAT_MS = 60_000;

type LogEntry = {
  id: string;
  type: 'info' | 'sos' | 'detected';
  message: string;
  time: string;
};

type Coords = {
  lat: number;
  lng: number;
};

type DisasterType = 'earthquake' | 'flood' | 'landslide' | null;

type AppStateContextType = {
  sosActive: boolean;
  disasterType: DisasterType;
  bluetoothOn: boolean;
  gpsLocked: boolean;
  coords: Coords | null;
  log: LogEntry[];
  startBeacon: (type: string) => Promise<void>;
  stopBeacon: () => Promise<void>;
};

const AppStateContext = createContext<AppStateContextType | null>(null);

function createClientId() {
  return `phone-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const clientIdRef = useRef(createClientId());

  const [sosActive, setSosActive]       = useState(false);
  const [disasterType, setDisasterType] = useState<DisasterType>(null);
  const [bluetoothOn, setBluetoothOn]   = useState(false);
  const [gpsLocked, setGpsLocked]       = useState(false);
  const [coords, setCoords]             = useState<Coords | null>(null);
  const [log, setLog]                   = useState<LogEntry[]>([
    { id: '1', type: 'info', message: 'App initialized', time: nowLabel() },
  ]);

  // Refs read by the SOS heartbeat timer (avoids stale closures).
  const coordsRef            = useRef<Coords | null>(null);
  const sosActiveRef         = useRef(false);
  const sosGenerationRef     = useRef(0);
  const heartbeatTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatInFlightRef = useRef(false);
  const heartbeatFailedRef   = useRef(false);

  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({});
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLocked(true);
      } catch (e) {
        setGpsLocked(false);
      }
    })();
  }, []);

  function addLog(type: LogEntry['type'], message: string) {
    setLog((prev) => [{ id: String(Date.now()), type, message, time: nowLabel() }, ...prev]);
  }

  async function refreshCoords(): Promise<Coords | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return coordsRef.current;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      coordsRef.current = next;
      setCoords(next);
      setGpsLocked(true);
      return next;
    } catch {
      return coordsRef.current;
    }
  }

  /** Best-effort phone GPS upload for web/cloud map (does not block BLE SOS). */
  async function postCitizenSos(
    type: string,
    position: Coords | null,
    mode: 'initial' | 'heartbeat' = 'initial',
  ) {
    // Use real coords if available; otherwise send null so the server stores
    // the SOS as "location unavailable" instead of a bogus 0,0 pin.
    const lat = position ? position.lat : null;
    const lng = position ? position.lng : null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientIdRef.current,
          lat,
          lng,
          disasterType: type,
          name: user?.name || 'Citizen',
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      // Log only the first send and recovery after a failure; routine
      // heartbeats stay silent so the in-app log isn't flooded.
      if (mode === 'initial' || heartbeatFailedRef.current) {
        const prefix = mode === 'initial' ? 'SOS sent to server' : 'SOS reconnected to server';
        addLog(
          'sos',
          position
            ? `${prefix} — ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`
            : `${prefix} — no GPS fix (location unavailable)`,
        );
      }
      heartbeatFailedRef.current = false;
    } catch (error) {
      console.error('Failed to post citizen SOS GPS', error);
      // Log the first failure in a streak; repeated heartbeat failures stay quiet.
      if (mode === 'initial' || !heartbeatFailedRef.current) {
        addLog('info', 'Could not reach server to place SOS on web map (BLE still active)');
      }
      heartbeatFailedRef.current = true;
    }
  }

  function stopHeartbeat() {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }

  /** Re-send the SOS every 60 s so the server (10 min TTL) keeps it live. */
  function startHeartbeat(type: string) {
    stopHeartbeat();
    const generation = sosGenerationRef.current;
    heartbeatTimerRef.current = setInterval(async () => {
      // Skip if the previous heartbeat is still in flight.
      if (heartbeatInFlightRef.current) return;
      heartbeatInFlightRef.current = true;
      try {
        const position = await refreshCoords();
        // The SOS may have been stopped while waiting for GPS; don't re-create it.
        if (sosGenerationRef.current !== generation || !sosActiveRef.current) return;
        await postCitizenSos(type, position, 'heartbeat');
      } finally {
        heartbeatInFlightRef.current = false;
      }
    }, SOS_HEARTBEAT_MS);
  }

  // Stop the heartbeat timer on unmount.
  useEffect(() => stopHeartbeat, []);

  async function clearCitizenSos() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/sos?clientId=${encodeURIComponent(clientIdRef.current)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      addLog('info', 'Phone GPS SOS cleared from map');
    } catch (error) {
      console.error('Failed to clear citizen SOS', error);
      addLog('info', 'Could not clear SOS pin on server (beacon stopped locally)');
    }
  }

  async function startBeacon(type: string) {
    // 1. Activate SOS state immediately — gives instant UI feedback
    setSosActive(true);
    sosActiveRef.current = true;
    sosGenerationRef.current += 1;
    heartbeatFailedRef.current = false;
    setDisasterType(type as DisasterType);
    addLog('sos', `SOS started — ${type.toUpperCase()} emergency`);

    // 2. HTTP upload — works on Expo Go and native builds (no BLE required)
    const generation = sosGenerationRef.current;
    const position = await refreshCoords();
    // Stopped while waiting for GPS — don't post or start the heartbeat.
    if (sosGenerationRef.current !== generation) return;
    void postCitizenSos(type, position);
    // Keep the server-side SOS alive while the beacon is on.
    startHeartbeat(type);

    // 3. BLE broadcast — best-effort secondary channel for offline mesh
    try {
      if (
        !BLEAdvertiser ||
        typeof BLEAdvertiser.isActive !== 'function' ||
        typeof BLEAdvertiser.setCompanyId !== 'function' ||
        typeof BLEAdvertiser.broadcast !== 'function'
      ) {
        addLog('info', 'BLE not available in this build — SOS sent via network only');
        return;
      }

      if (Platform.OS === 'android' && Number(Platform.Version) >= 31) {
        const permissions = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        const denied = Object.values(permissions).some(
          (permission) => permission !== PermissionsAndroid.RESULTS.GRANTED,
        );
        if (denied) {
          addLog('info', 'BLE permission denied — SOS sent via network only');
          return;
        }
      }

      if (!(await BLEAdvertiser.isActive())) {
        addLog('info', 'Bluetooth off — SOS sent via network only');
        return;
      }

      BLEAdvertiser.setCompanyId(0xffff);
      await BLEAdvertiser.broadcast(SOS_SERVICE_UUID, [], {
        advertiseMode: 2,
        txPowerLevel: 3,
        includeDeviceName: false,
        includeTxPowerLevel: false,
        connectable: false,
      });
      setBluetoothOn(true);
      addLog('sos', 'BLE beacon broadcasting — offline mesh active');
    } catch (error) {
      console.error('BLE broadcast failed (SOS still active via network)', error);
      addLog('info', 'BLE broadcast failed — SOS active via network only');
    }
  }

  async function stopBeacon() {
    setSosActive(false);
    sosActiveRef.current = false;
    sosGenerationRef.current += 1;
    stopHeartbeat();
    setDisasterType(null);
    setBluetoothOn(false);
    void clearCitizenSos();

    try {
      if (BLEAdvertiser && typeof BLEAdvertiser.stopBroadcast === 'function') {
        await BLEAdvertiser.stopBroadcast();
      }
      addLog('info', 'SOS beacon stopped');
    } catch (error) {
      console.error('BLE stop failed', error);
      addLog('info', 'SOS stopped (BLE stop confirmation unavailable)');
    }
  }

  return (
    <AppStateContext.Provider
      value={{ sosActive, disasterType, bluetoothOn, gpsLocked, coords, log, startBeacon, stopBeacon }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}

function nowLabel() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
