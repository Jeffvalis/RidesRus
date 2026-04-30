import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Platform, Modal, ScrollView, Animated, Alert, StatusBar
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@clerk/clerk-expo';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const BUS_STOPS = [
  'Ajah Market', 'VGC', 'Ikota', 'Ologolo',
  'Jakande', 'Chisco', 'Lekki Phase 1', 'Victoria Island'
];
const FARE = 500;
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.68.124:3005';

// ─── LEAFLET MAP HTML ─────────────────────────────────────────────────────────
const LEAFLET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map', { zoomControl: false, attributionControl: false })
      .setView([6.4550, 3.5820], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // User location
    L.circleMarker([6.4550, 3.5820], {
      radius: 9, fillColor: '#3b82f6', fillOpacity: 1, color: '#fff', weight: 3
    }).bindTooltip('You are here', { permanent: false }).addTo(map);

    const busMarkers = {};

    window.addOrUpdateBus = function(data) {
      const color = data.seats === 0 ? '#ef4444' : data.seats < 8 ? '#4d7c0f' : '#888';
      if (busMarkers[data.busId]) {
        busMarkers[data.busId].setLatLng([data.lat, data.lng]);
        busMarkers[data.busId].setStyle({ fillColor: color });
      } else {
        const marker = L.circleMarker([data.lat, data.lng], {
          radius: 16, fillColor: color, fillOpacity: 0.92, color: '#fff', weight: 2.5
        });
        marker.bindTooltip(data.busId, { permanent: false });
        marker.on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'bus_tap', ...data }));
        });
        marker.addTo(map);
        busMarkers[data.busId] = marker;
      }
    };
  </script>
</body>
</html>
`;

type BusStat = { busId: string; lat: number; lng: number; seats: number };

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export const MapScreen = ({ navigation }: any) => {
  const { signOut } = useAuth();
  const [buses, setBuses] = useState<BusStat[]>([]);
  const [selectedBus, setSelectedBus] = useState<BusStat | null>(null);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [stopModalVisible, setStopModalVisible] = useState(false);
  const [boardedStop, setBoardedStop] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const webViewRef = useRef<WebView>(null);

  // ── Socket connection
  useEffect(() => {
    const socket = io(API_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => console.log('[Socket] Connected to', API_URL));
    socket.on('connect_error', (e) => console.log('[Socket] Error:', e.message));

    socket.on('bus_moved', (data: { busId: string; lat: number; lng: number }) => {
      const busData: BusStat = {
        busId: data.busId,
        lat: data.lat,
        lng: data.lng,
        seats: Math.floor(Math.random() * 12) + 2,
      };
      setBuses(prev => {
        const exists = prev.find(b => b.busId === data.busId);
        return exists
          ? prev.map(b => b.busId === data.busId ? busData : b)
          : [...prev, busData];
      });
      webViewRef.current?.injectJavaScript(`
        try { window.addOrUpdateBus(${JSON.stringify(busData)}); } catch(e) {}
        true;
      `);
    });

    return () => { socket.disconnect(); };
  }, []);

  // ── WebView message (bus tap)
  const handleWebViewMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'bus_tap') {
        setSelectedBus(msg);
        setSelectedStop(null);
        socketRef.current?.emit('hail_bus', {
          busId: msg.busId,
          passengerId: 'passenger-' + Date.now(),
          userLat: msg.lat,
          userLng: msg.lng,
        });
      }
    } catch (_) {}
  };

  // ── Mock payment / boarding
  const handleBoard = () => {
    if (!selectedStop) {
      Alert.alert('Pick a stop', 'Please select your drop-off stop first.');
      return;
    }
    socketRef.current?.emit('passenger_stop_selected', {
      busId: selectedBus?.busId,
      passengerId: 'passenger-' + Date.now(),
      stopName: selectedStop,
      fare: FARE,
    });
    setStopModalVisible(false);
    setBoardedStop(selectedStop);
    setSelectedBus(null);
    setSelectedStop(null);
    setTimeout(() => setBoardedStop(null), 5000);
  };

  const handleLogout = async () => { await signOut(); };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* ── MAP SECTION (top ~55%) ───────────────────────────── */}
      <View style={styles.mapSection}>
        <WebView
          ref={webViewRef}
          style={StyleSheet.absoluteFillObject}
          source={{ html: LEAFLET_HTML }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
        />

        {/* Floating header over map */}
        <SafeAreaView style={styles.mapHeader} pointerEvents="box-none">
          <View style={styles.headerRow} pointerEvents="auto">
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#1a1a1a" />
            </TouchableOpacity>
            <Text style={styles.logoText}>RidesRus</Text>
            <View style={styles.headerRight}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={14} color="#fff" />
              </View>
            </View>
          </View>
        </SafeAreaView>

        {/* Legend bottom-left of map */}
        <View style={styles.legend} pointerEvents="none">
          {[['#ef4444', 'FULL'], ['#4d7c0f', 'SEATS'], ['#888', 'EMPTY']].map(([c, l]) => (
            <View key={l} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: c }]} />
              <Text style={styles.legendText}>{l}</Text>
            </View>
          ))}
        </View>

        {/* Boarding success banner */}
        {boardedStop && (
          <View style={styles.boardBanner}>
            <Ionicons name="checkmark-circle" size={18} color="#15803d" />
            <Text style={styles.boardBannerText}>Boarded! Drop-off: {boardedStop} · ₦{FARE} paid ✓</Text>
          </View>
        )}
      </View>

      {/* ── CONTROLS SECTION (bottom ~45%) ──────────────────── */}
      <View style={styles.controlsSection}>
        {/* Route label */}
        <View style={styles.routeBar}>
          <View style={styles.routeIconBox}>
            <Ionicons name="map" size={18} color="#665306" />
          </View>
          <Text style={styles.routeText}>Lekki – Victoria Island Corridor</Text>
          <Ionicons name="navigate" size={18} color="#ccc" />
        </View>

        {/* Bus info / idle state */}
        {selectedBus ? (
          <View style={styles.busCard}>
            <View style={styles.busCardLeft}>
              <Text style={styles.busId}>{selectedBus.busId}</Text>
              <Text style={styles.busSub}>{selectedBus.seats} seats · ₦{FARE} flat fare</Text>
              {selectedStop && <Text style={styles.stopChosen}>📍 Drop-off: {selectedStop}</Text>}
            </View>
            <View style={styles.busCardActions}>
              <TouchableOpacity style={styles.stopBtn} onPress={() => setStopModalVisible(true)}>
                <Ionicons name="location" size={13} color="#665306" />
                <Text style={styles.stopBtnText}>{selectedStop ? 'Change Stop' : 'Pick Stop'}</Text>
              </TouchableOpacity>
              {selectedStop && (
                <TouchableOpacity style={styles.boardBtn} onPress={handleBoard}>
                  <Ionicons name="checkmark" size={13} color="#fff" />
                  <Text style={styles.boardBtnText}>Confirm · ₦500</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={() => { setSelectedBus(null); setSelectedStop(null); }}>
              <Ionicons name="close-circle" size={22} color="#ccc" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.idleCard}>
            <View style={styles.idleIconBox}>
              <Ionicons name="hand-left" size={22} color="#665306" />
            </View>
            <View style={styles.idleText}>
              <Text style={styles.idleTitle}>
                {buses.length > 0
                  ? `${buses.length} bus${buses.length > 1 ? 'es' : ''} nearby — tap on map to board`
                  : 'Waiting for fleet data…'}
              </Text>
              <Text style={styles.idleSub}>Lekki · Ajah · VI · ₦500 flat fare</Text>
            </View>
          </View>
        )}
      </View>

      {/* ── STOP PICKER MODAL ─────────────────────────────────── */}
      <Modal visible={stopModalVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Choose Drop-Off Stop</Text>
            <Text style={styles.modalSub}>₦500 flat fare to any stop</Text>
            <ScrollView style={{ marginTop: 16 }}>
              {BUS_STOPS.map(stop => (
                <TouchableOpacity
                  key={stop}
                  style={[styles.stopItem, selectedStop === stop && styles.stopItemActive]}
                  onPress={() => setSelectedStop(stop)}
                >
                  <Ionicons
                    name={selectedStop === stop ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={selectedStop === stop ? '#656214' : '#aaa'}
                  />
                  <Text style={[styles.stopItemText, selectedStop === stop && { color: '#1a1a1a', fontWeight: '800' }]}>
                    {stop}
                  </Text>
                  {selectedStop === stop && (
                    <View style={styles.fareTag}><Text style={styles.fareTagText}>₦500</Text></View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.confirmBtn, !selectedStop && { opacity: 0.4 }]}
              onPress={handleBoard}
              disabled={!selectedStop}
            >
              <Text style={styles.confirmBtnText}>Confirm & Board — ₦500</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setStopModalVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f3ee' },

  // Map section
  mapSection: { flex: 55, position: 'relative', overflow: 'hidden' },
  mapHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 36 : 10, paddingBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  logoutBtn: { padding: 6 },
  logoText: { fontSize: 20, fontWeight: '900', color: '#1a1a1a' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  legend: { position: 'absolute', left: 12, bottom: 12, gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { fontSize: 10, fontWeight: '800', color: '#555' },
  boardBanner: { position: 'absolute', bottom: 12, left: 12, right: 12, backgroundColor: '#dcfce7', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  boardBannerText: { fontSize: 12, fontWeight: '700', color: '#14532d', flex: 1 },

  // Controls section
  controlsSection: { flex: 45, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  routeBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fdf9e3', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  routeIconBox: { width: 36, height: 36, backgroundColor: '#facc15', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  routeText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#555' },

  // Idle card
  idleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fafafa', borderRadius: 16, padding: 16, gap: 14, borderWidth: 1, borderColor: '#eee' },
  idleIconBox: { width: 44, height: 44, backgroundColor: '#fdf9e3', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  idleText: { flex: 1 },
  idleTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  idleSub: { fontSize: 12, color: '#888', marginTop: 3 },

  // Bus card
  busCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fdf9e3', borderRadius: 16, padding: 14, gap: 12, borderWidth: 1.5, borderColor: '#e0c84b' },
  busCardLeft: { flex: 1 },
  busId: { fontSize: 15, fontWeight: '900', color: '#1a1a1a' },
  busSub: { fontSize: 12, color: '#888', marginTop: 2 },
  stopChosen: { fontSize: 12, color: '#656214', fontWeight: '700', marginTop: 4 },
  busCardActions: { gap: 8 },
  stopBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#e0c84b' },
  stopBtnText: { fontSize: 11, fontWeight: '800', color: '#665306' },
  boardBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#15803d', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  boardBtnText: { fontSize: 11, fontWeight: '800', color: '#fff' },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 44, maxHeight: '80%' },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#1a1a1a' },
  modalSub: { fontSize: 14, color: '#888', marginTop: 4 },
  stopItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, marginBottom: 6, gap: 12, backgroundColor: '#fafafa' },
  stopItemActive: { backgroundColor: '#fdf9e3', borderWidth: 1.5, borderColor: '#e0c84b' },
  stopItemText: { flex: 1, fontSize: 15, color: '#555', fontWeight: '600' },
  fareTag: { backgroundColor: '#656214', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  fareTagText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#15803d', height: 54, borderRadius: 14, marginTop: 20 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', marginTop: 12 },
  cancelText: { fontSize: 14, color: '#888', fontWeight: '600' },
});
