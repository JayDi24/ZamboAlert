import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Mono } from '../components/SharedUI';
import { styles } from '../theme/styles';
import { situationColors, logTypeColors } from '../assets/mockData';

export interface VictimItem {
  id: string;
  label: string;
  situation: 'safe' | 'injured' | 'trapped' | 'lost or unable to move';
  disasterType?: string;
  floor?: number;
  distance?: number;
  bearing?: number;
}

export interface LogEntry {
  id: string;
  time: string;
  type: string;
  message: string;
}

export interface LogViewProps {
  log: LogEntry[];
  onAddLog: (
    type: string,
    message: string,
    showToast?: boolean,
    toastTitle?: string,
    toastDesc?: string
  ) => void;
  victims: VictimItem[];
  onUpdateVictimSituation: (id: string, newSituation: string, newDisaster?: string) => void;
  onAddNewVictim: (label: string, situation: string, disaster?: string) => string;
}

export function LogView({
  log,
  onAddLog,
  victims,
  onUpdateVictimSituation,
  onAddNewVictim,
}: LogViewProps) {
  const [activeTab, setActiveTab] = useState<'casualty' | 'victim'>('casualty');

  // Casualty state
  const [casualtyCount, setCasualtyCount] = useState('');
  const [disasterType, setDisasterType] = useState<'Earthquake' | 'Fire' | 'Flood' | 'Landslide' | ''>('');

  // Victim Log state
  const [selectedVictimId, setSelectedVictimId] = useState('');
  const [victimLabel, setVictimLabel] = useState('');
  const [victimSituation, setVictimSituation] = useState<'safe' | 'injured' | 'trapped' | 'lost or unable to move' | ''>('');
  const [victimDisaster, setVictimDisaster] = useState<'Earthquake' | 'Fire' | 'Flood' | 'Landslide' | ''>('');
  const [logNotes, setLogNotes] = useState('');

  const handleCasualtyLog = () => {
    if (!disasterType || !casualtyCount) return;
    onAddLog(
      'alert',
      `Casualties recorded for ${disasterType}: ${casualtyCount}`,
      true,
      'Casualties Recorded',
      `Successfully logged ${casualtyCount} casualties for ${disasterType}.`
    );
    setCasualtyCount('');
    setDisasterType('');
  };

  const handleVictimLog = () => {
    if (!victimLabel.trim()) return;

    const label = victimLabel.trim().toUpperCase();
    const situation = victimSituation || 'safe';
    const disaster = victimDisaster || '';

    // Check if the victim exists
    const existingVictim = victims.find(
      (v) => v.label.toUpperCase() === label || v.id.toUpperCase() === label
    );

    let finalId = '';
    let isNew = false;
    if (existingVictim) {
      finalId = existingVictim.id;
      onUpdateVictimSituation(finalId, situation, disaster);
    } else {
      finalId = onAddNewVictim(label, situation, disaster);
      isNew = true;
    }

    let msg = `Victim status update for ${label}`;
    if (isNew) {
      msg = `New victim registered: ${label}`;
    }

    msg += ` · Status: ${situation.toUpperCase()}`;
    if (disaster) {
      msg += ` · Disaster Area: ${disaster.toUpperCase()}`;
    }
    if (logNotes.trim()) {
      msg += ` · Note: ${logNotes.trim()}`;
    }

    onAddLog(
      'victim',
      msg,
      true,
      isNew ? 'Victim Registered' : 'Victim Updated',
      isNew ? `Successfully registered and placed ${label} on radar.` : `Successfully updated details for ${label}.`
    );

    setVictimLabel('');
    setSelectedVictimId('');
    setVictimSituation('');
    setVictimDisaster('');
    setLogNotes('');
  };

  return (
    <View style={styles.viewContainer}>
      <View style={styles.logActionCard}>
        {/* Segmented Control */}
        <View style={{ flexDirection: 'row', marginBottom: 16, backgroundColor: '#f3f4f6', borderRadius: 10, padding: 3 }}>
          <TouchableOpacity
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
              borderRadius: 8,
              backgroundColor: activeTab === 'casualty' ? '#ffffff' : 'transparent',
              shadowColor: activeTab === 'casualty' ? '#000' : 'transparent',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: activeTab === 'casualty' ? 0.1 : 0,
              shadowRadius: 2,
              elevation: activeTab === 'casualty' ? 2 : 0,
            }}
            onPress={() => setActiveTab('casualty')}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: activeTab === 'casualty' ? '#dc2626' : '#4b5563' }}>
              General Casualties
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flex: 1,
              paddingVertical: 10,
              alignItems: 'center',
              borderRadius: 8,
              backgroundColor: activeTab === 'victim' ? '#ffffff' : 'transparent',
              shadowColor: activeTab === 'victim' ? '#000' : 'transparent',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: activeTab === 'victim' ? 0.1 : 0,
              shadowRadius: 2,
              elevation: activeTab === 'victim' ? 2 : 0,
            }}
            onPress={() => setActiveTab('victim')}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: activeTab === 'victim' ? '#dc2626' : '#4b5563' }}>
              Victim Updates
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'casualty' ? (
          <View>
            <Text style={styles.sectionTitle}>Record Casualties</Text>
            <View style={styles.disasterButtons}>
              {(['Earthquake', 'Fire', 'Flood', 'Landslide'] as const).map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.disasterBtn, disasterType === d && styles.disasterBtnActive]}
                  onPress={() => setDisasterType(d)}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[styles.disasterBtnText, disasterType === d && styles.disasterBtnTextActive]}
                  >
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Number of casualties"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={casualtyCount}
              onChangeText={setCasualtyCount}
            />
            <TouchableOpacity style={styles.submitLogBtn} onPress={handleCasualtyLog}>
              <Text style={styles.submitLogBtnText}>Submit Log</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={styles.sectionTitle}>Record / Update Victim Info</Text>

            {/* Horizontal Victim Chips */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 }}>
              Select Existing Victim:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ paddingVertical: 4 }}>
              {victims.map((v) => {
                const isSelected = selectedVictimId === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    onPress={() => {
                      setSelectedVictimId(v.id);
                      setVictimLabel(v.label);
                      setVictimSituation(v.situation);
                      setVictimDisaster(v.disasterType || '');
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: isSelected ? '#dc2626' : '#f3f4f6',
                      borderRadius: 20,
                      marginRight: 8,
                      borderWidth: 1,
                      borderColor: isSelected ? '#dc2626' : 'rgba(0,0,0,0.06)',
                      shadowColor: isSelected ? '#dc2626' : 'transparent',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: isSelected ? 0.2 : 0,
                      shadowRadius: 2,
                      elevation: isSelected ? 1 : 0,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: isSelected ? '#ffffff' : '#4b5563' }}>
                      {v.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                onPress={() => {
                  setSelectedVictimId('');
                  setVictimLabel('');
                  setVictimSituation('');
                  setVictimDisaster('');
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: selectedVictimId === '' && !victimLabel ? '#dc2626' : '#f3f4f6',
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: selectedVictimId === '' && !victimLabel ? '#dc2626' : 'rgba(0,0,0,0.06)',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: selectedVictimId === '' && !victimLabel ? '#ffffff' : '#4b5563' }}>
                  + NEW VICTIM
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 }}>
              Victim Name / ID:
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. VICTIM-05 or John Doe"
              placeholderTextColor="#666"
              value={victimLabel}
              onChangeText={(text) => {
                setVictimLabel(text);
                const found = victims.find(
                  (v) =>
                    v.label.toLowerCase() === text.trim().toLowerCase() ||
                    v.id.toLowerCase() === text.trim().toLowerCase()
                );
                if (found) {
                  setSelectedVictimId(found.id);
                  setVictimSituation(found.situation);
                  setVictimDisaster(found.disasterType || '');
                } else {
                  setSelectedVictimId('');
                }
              }}
            />

            <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 }}>
              Condition / Situation:
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {(['safe', 'injured', 'trapped', 'lost or unable to move'] as const).map((sit) => {
                const isSelected = victimSituation === sit;
                const sitColor = situationColors[sit as keyof typeof situationColors] || { bg: '#9ca3af', dot: '#9ca3af' };
                return (
                  <TouchableOpacity
                    key={sit}
                    onPress={() => setVictimSituation(sit)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: isSelected ? sitColor.bg : '#f3f4f6',
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isSelected ? sitColor.bg : 'rgba(0,0,0,0.08)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '45%',
                      flexGrow: 1,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? '#ffffff' : '#4b5563', textTransform: 'uppercase' }}>
                      {sit}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 }}>
              Disaster Area:
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {(['Flood', 'Landslide', 'Earthquake', 'Fire'] as const).map((d) => {
                const isSelected = victimDisaster === d;
                let activeColor = '#3b82f6';
                if (d === 'Landslide') activeColor = '#d97706';
                if (d === 'Earthquake') activeColor = '#4b5563';
                if (d === 'Fire') activeColor = '#ef4444';
                return (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setVictimDisaster(d)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: isSelected ? activeColor : '#f3f4f6',
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isSelected ? activeColor : 'rgba(0,0,0,0.08)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '22%',
                      flexGrow: 1,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? '#ffffff' : '#4b5563', textTransform: 'uppercase' }}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 }}>
              Notes / Observations:
            </Text>
            <TextInput
              style={[styles.input, { height: 60, textAlignVertical: 'top', paddingTop: 8 }]}
              placeholder="e.g. Found on 2nd floor, stable, given first aid kit."
              placeholderTextColor="#666"
              multiline
              numberOfLines={2}
              value={logNotes}
              onChangeText={setLogNotes}
            />

            <TouchableOpacity style={styles.submitLogBtn} onPress={handleVictimLog}>
              <Text style={styles.submitLogBtnText}>Submit Victim Log</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.listContainer}>
        {log.map((entry) => {
          const t = logTypeColors[entry.type as keyof typeof logTypeColors] || { label: 'LOG', color: '#6b7280' };
          return (
            <View key={entry.id} style={styles.logCard}>
              <View style={styles.logCardHeader}>
                <Text style={[styles.logCardLabel, { color: t.color }]}>{t.label}</Text>
                <Mono style={styles.logCardTime}>{entry.time}</Mono>
              </View>
              <Text style={styles.logCardMessage}>{entry.message}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
