
// src/context/AppStateContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as BLEAdvertiser from 'react-native-ble-advertiser';

const SOS_SERVICE_UUID = 'fef10001-7b82-4b93-b2c2-0f81ea3300a1';

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
  log: LogEntry[];
  startBeacon: (type: string) => Promise<void>;
  stopBeacon: () => Promise<void>;
};

const AppStateContext = createContext<AppStateContextType | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [sosActive, setSosActive]       = useState(false);
  const [disasterType, setDisasterType] = useState<DisasterType>(null);
  const [bluetoothOn, setBluetoothOn]   = useState(false);
  const [gpsLocked, setGpsLocked]       = useState(false);
  const [coords, setCoords]             = useState<Coords | null>(null);
  const [log, setLog]                   = useState<LogEntry[]>([
    { id: '1', type: 'info', message: 'App initialized', time: nowLabel() },
  ]);

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

  async function startBeacon(type: string) {
    try {
      if (Platform.OS === 'android' && Number(Platform.Version) >= 31) {
        const permissions = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        const denied = Object.values(permissions).some(
          (permission) => permission !== PermissionsAndroid.RESULTS.GRANTED,
        );
        if (denied) throw new Error('Allow Nearby devices permissions to broadcast an SOS.');
      }

      if (!(await BLEAdvertiser.isActive())) {
        throw new Error('Turn on Bluetooth to broadcast an SOS.');
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
      setSosActive(true);
      setDisasterType(type as DisasterType);
      addLog('sos', `SOS beacon started — ${type.toUpperCase()} emergency — broadcasting over BLE`);
    } catch (error) {
      console.error('Failed to start BLE SOS beacon', error);
      const message = error instanceof Error ? error.message : 'Bluetooth advertising failed.';
      Alert.alert('Could not start SOS beacon', message);
    }
  }

  async function stopBeacon() {
    try {
      await BLEAdvertiser.stopBroadcast();
      addLog('info', 'SOS beacon stopped');
    } catch (error) {
      console.error('Failed to stop BLE SOS beacon', error);
      Alert.alert('Could not confirm beacon stop', 'Bluetooth may have stopped broadcasting, but the app could not confirm it.');
    }

    setBluetoothOn(false);
    setSosActive(false);
    setDisasterType(null);
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