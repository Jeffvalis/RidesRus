import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, SafeAreaView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { queueAction } from '../queue/offlineQueue';
import { connectDriverSocket } from '../services/driverSocket';

type HailAlert = { id: number; type: 'hail' | 'stop'; stop: string; passengers: number; distance: string; fare?: number };

const BUS_ID = 'RR-904-LG'; // This driver's bus ID

export const ConsoleScreen = ({ navigation }: any) => {
  const [hails, setHails] = useState<HailAlert[]>([]);
  const idRef = useRef(1);

  useEffect(() => {
    const socket = connectDriverSocket(BUS_ID);

    // Passenger hailed a bus → pickup alert
    socket.on('new_hail', (data: { passengerId: string; lat: number; lng: number }) => {
      const newHail: HailAlert = {
        id: idRef.current++,
        type: 'hail',
        stop: `Lat ${data.lat.toFixed(4)}, Lng ${data.lng.toFixed(4)}`,
        passengers: 1,
        distance: 'Nearby',
      };
      setHails(prev => [newHail, ...prev].slice(0, 10));
    });

    // Passenger confirmed stop after payment → destination alert
    socket.on('stop_update', (data: { passengerId: string; stopName: string; fare: number }) => {
      const stopAlert: HailAlert = {
        id: idRef.current++,
        type: 'stop',
        stop: data.stopName,
        passengers: 1,
        distance: 'Paid ✓',
        fare: data.fare,
      };
      setHails(prev => [stopAlert, ...prev].slice(0, 10));
    });

    return () => {
      socket.off('new_hail');
      socket.off('stop_update');
    };
  }, []);

  const removeHail = (id: number) => {
    setHails(prev => prev.filter(h => h.id !== id));
  };

  const _renderMap = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.webMapMock}>
          {/* Abstract map lines for web parity */}
          <View style={[styles.mapLine, { top: '30%', width: '100%' }]} />
          <View style={[styles.mapLine, { top: '60%', width: '100%', transform: [{ rotate: '15deg' }] }]} />
          <View style={[styles.mapLine, { left: '40%', height: '100%' }]} />
          <Ionicons name="location" size={24} color="#facc15" style={{ position: 'absolute', top: '25%', left: '30%' }} />
          <Ionicons name="location" size={24} color="#facc15" style={{ position: 'absolute', top: '45%', left: '60%' }} />
          <Ionicons name="location" size={24} color="#3b82f6" style={{ position: 'absolute', top: '70%', left: '80%' }} />
        </View>
      );
    }
    // Native map evaluation isolated to avoid web bundle crash
    return (
      <View style={{ flex: 1, backgroundColor: '#2d3748', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{color: '#888'}}>Native MapBox Render</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="menu" size={28} color="#1a1a1a" style={{ marginRight: 16 }} />
          <Text style={styles.headerLogo}>RidesRus</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.routeHeader}>
            <Text style={styles.routeTitle}>Route 42A – Victoria Island</Text>
            <Text style={styles.routeSub}>BUS ID: RR-904-LG</Text>
          </View>
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color="#fff" />
          </View>
        </View>
      </View>

      <View style={styles.mainContent}>
        {/* Left Column (Map) */}
        <View style={styles.leftCol}>
          <View style={styles.mapContainer}>
            {_renderMap()}

            {/* Map Action Buttons */}
            <View style={styles.mapActions}>
              <TouchableOpacity style={styles.mapActionBtn}>
                 <Ionicons name="locate" size={20} color="#1a1a1a" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.mapActionBtn}>
                 <Ionicons name="layers" size={20} color="#1a1a1a" />
              </TouchableOpacity>
            </View>

            {/* Floating Next Stop Pill */}
            <View style={styles.nextStopPill}>
              <View style={styles.nextStopIcon}>
                <Ionicons name="bus" size={24} color="#fff" />
              </View>
              <View style={styles.nextStopText}>
                <Text style={styles.nextStopLabel}>NEXT STOP</Text>
                <Text style={styles.nextStopName}>Lekki Phase 1</Text>
              </View>
              <View style={styles.nextStopMeta}>
                <Text style={styles.nextStopMins}>4 <Text style={styles.nextStopMinsUnit}>mins</Text></Text>
                <Text style={styles.nextStopDist}>0.8 km remaining</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Right Column (Dash) */}
        <View style={styles.rightCol}>
          
          {/* Top Row Metrics */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>TOTAL PASSENGERS</Text>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricBig}>24</Text>
                <Text style={styles.metricSmall}>/ 40</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: '60%' }]} />
              </View>
            </View>
            <View style={[styles.metricCard, { backgroundColor: '#d9f99d' }]}>
              <Text style={styles.metricLabel}>REMAINING SEATS</Text>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricBig}>16</Text>
                <Ionicons name="easel" size={28} color="#3f6212" style={{ marginLeft: 10, marginTop: 4 }} />
              </View>
              <Text style={styles.metricBottomSub}>Optimal Capacity</Text>
            </View>
          </View>

          <Text style={styles.sectionHeader}>Passenger Alerts</Text>
          <ScrollView style={styles.hailList} showsVerticalScrollIndicator={false}>
            {hails.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="radio-button-off" size={28} color="#ccc" />
                <Text style={styles.emptyStateText}>Waiting for passenger alerts...</Text>
              </View>
            )}
            {hails.map(hail => (
              <View key={hail.id} style={[styles.hailCard, hail.type === 'stop' && styles.hailCardStop]}>
                <View style={[styles.hailIcon, hail.type === 'stop' && { backgroundColor: '#dcfce7' }]}>
                  <Ionicons
                    name={hail.type === 'stop' ? 'flag' : 'location'}
                    size={16}
                    color={hail.type === 'stop' ? '#15803d' : '#656214'}
                  />
                </View>
                <View style={styles.hailContent}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.hailTitle}>{hail.stop}</Text>
                    <View style={[styles.typeBadge, hail.type === 'stop' ? styles.typeBadgeStop : styles.typeBadgeHail]}>
                      <Text style={styles.typeBadgeText}>{hail.type === 'stop' ? 'DROP-OFF' : 'PICK UP'}</Text>
                    </View>
                  </View>
                  <Text style={styles.hailSub}>
                    {hail.passengers} Passenger{hail.passengers > 1 ? 's' : ''} •{' '}
                    <Text style={{ color: hail.type === 'stop' ? '#15803d' : '#1d4ed8', fontWeight: '700' }}>
                      {hail.type === 'stop' ? `₦${hail.fare} PAID` : hail.distance}
                    </Text>
                  </Text>
                </View>
                <TouchableOpacity style={[styles.ackBtn, hail.type === 'stop' && { backgroundColor: '#15803d' }]} onPress={() => removeHail(hail.id)}>
                  <Text style={styles.ackText}>ACK</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <Text style={styles.sectionHeader}>Recent Boardings</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.boardingsRow}>
            {['David K.', 'Sarah J.', 'Tunde O.'].map((name, i) => (
              <View key={i} style={styles.boardingCard}>
                <View style={styles.boardingUser}>
                  <View style={styles.boardingAvatar}>
                    <Ionicons name="person" size={14} color="#555" />
                  </View>
                  <Text style={styles.boardingName}>{name}</Text>
                </View>
                <View style={styles.boardingValid}>
                  <Ionicons name="checkmark-circle" size={12} color="#15803d" />
                  <Text style={styles.boardingValidText}>QR VALIDATED</Text>
                </View>
                <Text style={styles.boardingTime}>Confirmed {i*3 + 2}m ago</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Action Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerNextBtn}>
          <Ionicons name="location-sharp" size={20} color="#fff" />
          <Text style={styles.footerNextText}>NEXT STOP REACHED</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerEndBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="log-out-outline" size={20} color="#1a1a1a" />
          <Text style={styles.footerEndText}>END TRIP</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerSosBtn}>
          <Ionicons name="alert" size={28} color="#fff" />
          <Text style={styles.footerSosText}>SOS</Text>
        </TouchableOpacity>
      </View>
      
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f7f6f4' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 28, paddingTop: 20, paddingBottom: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: { fontSize: 24, fontWeight: '900', color: '#1a1a1a', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  routeHeader: { alignItems: 'flex-end' },
  routeTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  routeSub: { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },

  mainContent: { flex: 1, flexDirection: 'row', paddingHorizontal: 28, gap: 32 },
  
  leftCol: { flex: 0.45 },
  mapContainer: { flex: 1, borderRadius: 24, overflow: 'hidden', position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 5 },
  webMapMock: { flex: 1, backgroundColor: '#3f4f5a', overflow: 'hidden' },
  mapLine: { position: 'absolute', backgroundColor: '#facc15', opacity: 0.8, height: 4 },
  
  mapActions: { position: 'absolute', right: 16, top: 16, gap: 8 },
  mapActionBtn: { width: 44, height: 44, backgroundColor: '#fff', borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  
  nextStopPill: { position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 8 },
  nextStopIcon: { width: 48, height: 48, backgroundColor: '#656214', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  nextStopText: { flex: 1 },
  nextStopLabel: { fontSize: 10, fontWeight: '800', color: '#888', letterSpacing: 1, marginBottom: 2 },
  nextStopName: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  nextStopMeta: { alignItems: 'flex-end' },
  nextStopMins: { fontSize: 24, fontWeight: '900', color: '#1d4ed8' },
  nextStopMinsUnit: { fontSize: 14, fontWeight: '700' },
  nextStopDist: { fontSize: 11, color: '#888', fontWeight: '500' },

  rightCol: { flex: 0.55 },
  metricsRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  metricCard: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  metricLabel: { fontSize: 11, fontWeight: '800', color: '#666', letterSpacing: 1, marginBottom: 8 },
  metricValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  metricBig: { fontSize: 40, fontWeight: '900', color: '#1a1a1a', letterSpacing: -1 },
  metricSmall: { fontSize: 20, fontWeight: '700', color: '#888', marginLeft: 4 },
  progressBar: { height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, marginTop: 16 },
  progressFill: { height: '100%', backgroundColor: '#656214', borderRadius: 4 },
  metricBottomSub: { fontSize: 13, color: '#4d7c0f', fontWeight: '700', marginTop: 12 },

  sectionHeader: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 12 },
  hailList: { flex: 1, marginBottom: 24 },
  hailCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6, elevation: 1 },
  hailIcon: { width: 40, height: 40, backgroundColor: '#fdfce1', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  hailContent: { flex: 1 },
  hailTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 2 },
  hailSub: { fontSize: 12, color: '#666' },
  ackBtn: { backgroundColor: '#656214', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  ackText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  boardingsRow: { flexDirection: 'row' },
  boardingCard: { backgroundColor: '#fff', padding: 16, borderRadius: 14, marginRight: 12, width: 140, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6, elevation: 1 },
  boardingUser: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  boardingAvatar: { width: 24, height: 24, backgroundColor: '#f0f0f0', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  boardingName: { fontSize: 13, fontWeight: '800', color: '#1a1a1a' },
  boardingValid: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  boardingValidText: { fontSize: 9, fontWeight: '900', color: '#15803d', letterSpacing: 0.5 },
  boardingTime: { fontSize: 10, color: '#888' },

  hailCardStop: { borderLeftWidth: 3, borderLeftColor: '#15803d' },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typeBadgeHail: { backgroundColor: '#fef9c3' },
  typeBadgeStop: { backgroundColor: '#dcfce7' },
  typeBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5, color: '#1a1a1a' },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyStateText: { fontSize: 13, color: '#bbb', fontWeight: '600' },

  footer: { flexDirection: 'row', paddingHorizontal: 28, paddingTop: 20, paddingBottom: 24, gap: 16 },
  footerNextBtn: { flex: 0.65, backgroundColor: '#3b5add', borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 72, gap: 10 },
  footerNextText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  footerEndBtn: { flex: 0.20, backgroundColor: '#e2dfd9', borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 72, gap: 8 },
  footerEndText: { color: '#1a1a1a', fontSize: 16, fontWeight: '800' },
  footerSosBtn: { flex: 0.15, backgroundColor: '#dc2626', borderRadius: 16, justifyContent: 'center', alignItems: 'center', height: 72 },
  footerSosText: { color: '#fff', fontSize: 11, fontWeight: '900', marginTop: -2 }
});
