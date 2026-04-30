import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const LoginScreen = ({ navigation }: any) => {
  const [driverId, setDriverId] = useState('');
  const [pin, setPin] = useState('');

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="menu" size={24} color="#1a1a1a" style={{ marginRight: 16 }} />
            <Text style={styles.headerLogo}>RidesRus</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.versionBadge}>
              <Ionicons name="terminal-outline" size={14} color="#1d4ed8" />
              <Text style={styles.versionText}>CONSOLE V2.4</Text>
            </View>
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color="#fff" />
            </View>
          </View>
        </View>

        {/* Two Column Layout */}
        <View style={styles.content}>
          {/* Left Column: Command Center Context */}
          <View style={styles.leftCol}>
            <View style={styles.onlineBadge}>
              <Text style={styles.onlineText}>SYSTEM ONLINE</Text>
            </View>
            
            <Text style={styles.heroTitle}>Shift</Text>
            <Text style={styles.heroTitle}>Command</Text>
            <Text style={styles.heroTitle}>Center.</Text>

            <View style={styles.infoBlock}>
              <View style={styles.iconBox}>
                <Ionicons name="shield-checkmark" size={18} color="#656214" />
              </View>
              <View style={styles.infoTextGroup}>
                <Text style={styles.infoLabel}>Secure Protocol</Text>
                <Text style={styles.infoSub}>Authorized fleet personnel only. Access is logged and monitored for compliance.</Text>
              </View>
            </View>

            <View style={styles.infoBlock}>
              <View style={styles.iconBox}>
                <Ionicons name="alert-circle" size={18} color="#1d4ed8" />
              </View>
              <View style={styles.infoTextGroup}>
                <Text style={styles.infoLabel}>Emergency Access</Text>
                <Text style={styles.infoSub}>In case of lockout, contact your dispatcher or fleet manager immediately.</Text>
              </View>
            </View>
          </View>

          {/* Right Column: Form Card */}
          <View style={styles.rightCol}>
            <View style={styles.card}>
              
              <Text style={styles.inputLabel}>DRIVER IDENTIFICATION NUMBER</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="id-card" size={20} color="#666" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g. RR-9942" 
                  placeholderTextColor="#b0b0b0"
                  value={driverId}
                  onChangeText={setDriverId}
                  autoCapitalize="characters"
                />
              </View>

              <Text style={[styles.inputLabel, { marginTop: 24 }]}>SECURITY PIN / ACCESS KEY</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input} 
                  placeholder="••••••" 
                  placeholderTextColor="#b0b0b0"
                  secureTextEntry
                  value={pin}
                  onChangeText={setPin}
                  keyboardType="number-pad"
                />
              </View>

              <TouchableOpacity style={styles.ctaButton} onPress={() => navigation.replace('Console')}>
                <Text style={styles.ctaText}>INITIALIZE SHIFT</Text>
                <Ionicons name="arrow-forward" size={20} color="#3f3f0e" />
              </TouchableOpacity>

              <View style={styles.optionsRow}>
                <View style={styles.checkboxGroup}>
                  <View style={styles.checkbox} />
                  <Text style={styles.checkboxLabel}>Stay logged in for 12h shift</Text>
                </View>
                <Text style={styles.forgotLink}>Forgot ID?</Text>
              </View>

              <View style={styles.cardDivider} />
              
              <View style={styles.cardFooter}>
                <Ionicons name="information-circle" size={16} color="#656214" style={{ marginTop: 2 }} />
                <Text style={styles.cardFooterText}>
                  System configuration and route assignments are managed by the Fleet HQ Backend. Registration is not available on this terminal.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Absolute Bottom Color Strip */}
        <View style={styles.colorStrip}>
          <View style={[styles.stripSegment, { backgroundColor: '#656214' }]} />
          <View style={[styles.stripSegment, { backgroundColor: '#1d4ed8' }]} />
          <View style={[styles.stripSegment, { backgroundColor: '#4d7c0f' }]} />
          <View style={[styles.stripSegment, { backgroundColor: '#b91c1c' }]} />
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#faf9f8' },
  container: { flex: 1 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 32, paddingTop: 20, zIndex: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: { fontSize: 24, fontWeight: '900', color: '#1a1a1a', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  versionBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f4ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  versionText: { color: '#666', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#facc15' },

  content: { flex: 1, flexDirection: 'row', paddingHorizontal: 32, alignItems: 'center' },
  
  leftCol: { flex: 0.9, paddingRight: 40 },
  onlineBadge: { backgroundColor: '#d9f99d', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 24 },
  onlineText: { color: '#4d7c0f', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { fontSize: 56, fontWeight: '900', color: '#1a1a1a', letterSpacing: -2, lineHeight: 62 },
  
  infoBlock: { flexDirection: 'row', marginTop: 32, gap: 16 },
  iconBox: { width: 44, height: 44, backgroundColor: '#fff', borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 },
  infoTextGroup: { flex: 1 },
  infoLabel: { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  infoSub: { fontSize: 13, color: '#666', lineHeight: 20 },

  rightCol: { flex: 1.1, alignItems: 'flex-end' },
  card: { backgroundColor: '#fff', width: '90%', borderRadius: 24, padding: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.05, shadowRadius: 30, elevation: 10 },
  
  inputLabel: { fontSize: 11, fontWeight: '800', color: '#656214', letterSpacing: 1, marginBottom: 12 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f3f0', height: 60, borderRadius: 12, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 18, color: '#1a1a1a', fontWeight: '500' },
  
  ctaButton: { flexDirection: 'row', height: 60, backgroundColor: '#facc15', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 32, marginBottom: 24, gap: 10 },
  ctaText: { color: '#3f3f0e', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  
  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  checkboxGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 20, height: 20, borderWidth: 1.5, borderColor: '#d1d1d1', borderRadius: 4 },
  checkboxLabel: { fontSize: 13, color: '#555', fontWeight: '500' },
  forgotLink: { fontSize: 13, color: '#1d4ed8', fontWeight: '800' },
  
  cardDivider: { height: 1, backgroundColor: '#eee', marginVertical: 24 },
  
  cardFooter: { flexDirection: 'row', gap: 10 },
  cardFooterText: { flex: 1, fontSize: 11, color: '#888', lineHeight: 18 },

  colorStrip: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', height: 8 },
  stripSegment: { flex: 1 }
});
