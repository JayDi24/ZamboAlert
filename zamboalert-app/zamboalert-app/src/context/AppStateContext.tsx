// src/context/AppStateContext.tsx
import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import * as Location from 'expo-location';

type Pod = {
  id: string;
  label: string;
  rssi: number;
};

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

type DisasterType = 'earthquake' | 'flood' | 'fire' | 'landslide' | null;

type AppStateContextType = {
  sosActive: boolean;
  disasterType: DisasterType;
  bluetoothOn: boolean;
  gpsLocked: boolean;
  coords: Coords | null;
  nearbyPods: Pod[];
  log: LogEntry[];
  startBeacon: (type: string) => void;
  stopBeacon: () => void;
};

const AppStateContext = createContext<AppStateContextType | null>(null);

const MOCK_PODS: Pod[] = [
  { id: 'pod-01', label: 'Pod-01', rssi: -58 },
  { id: 'pod-02', label: 'Pod-02', rssi: -74 },
];

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [sosActive, setSosActive]       = useState(false);
  const [disasterType, setDisasterType] = useState<DisasterType>(null);
  const [bluetoothOn]                   = useState(true);
  const [gpsLocked, setGpsLocked]       = useState(false);
  const [coords, setCoords]             = useState<Coords | null>(null);
  const [nearbyPods, setNearbyPods]     = useState<Pod[]>([]);
  const [log, setLog]                   = useState<LogEntry[]>([
    { id: '1', type: 'info', message: 'App initialized', time: nowLabel() },
  ]);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function startBeacon(type: string) {
    setSosActive(true);
    setDisasterType(type as DisasterType);
    addLog('sos', `SOS beacon started — ${type.toUpperCase()} emergency — broadcasting over BLE`);
    pollRef.current = setTimeout(() => {
      setNearbyPods(MOCK_PODS);
      addLog('detected', 'Detected by Pod-01 — bridged to LoRa mesh');
    }, 4000);
  }

  function stopBeacon() {
    setSosActive(false);
    setDisasterType(null);
    setNearbyPods([]);
    if (pollRef.current) clearTimeout(pollRef.current);
    addLog('info', 'SOS beacon stopped');
  }

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  return (
    <AppStateContext.Provider
      value={{ sosActive, disasterType, bluetoothOn, gpsLocked, coords, nearbyPods, log, startBeacon, stopBeacon }}
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