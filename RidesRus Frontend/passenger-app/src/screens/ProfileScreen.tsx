import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useUser } from '@clerk/clerk-expo';

export const ProfileScreen = () => {
  const { signOut } = useAuth();
  const { user } = useUser();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarInitials}>
              {user?.firstName?.[0] || ''}{user?.lastName?.[0] || ''}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>
              {user?.firstName || 'User'} {user?.lastName || ''}
            </Text>
            <Text style={styles.userEmail}>
              {user?.primaryEmailAddress?.emailAddress || 'No email provided'}
            </Text>
          </View>
          <TouchableOpacity style={styles.editBtn}>
            <Ionicons name="pencil" size={16} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Account Settings */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#fdf9e3' }]}>
              <Ionicons name="person-outline" size={18} color="#665306" />
            </View>
            <Text style={styles.menuText}>Personal Information</Text>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#e0f2fe' }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#0369a1" />
            </View>
            <Text style={styles.menuText}>Security & Privacy</Text>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Preferences */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Preferences</Text>
        <View style={styles.menuGroup}>
          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#f3e8ff' }]}>
              <Ionicons name="notifications-outline" size={18} color="#7e22ce" />
            </View>
            <Text style={styles.menuText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: '#ffedd5' }]}>
              <Ionicons name="globe-outline" size={18} color="#c2410c" />
            </View>
            <Text style={styles.menuText}>Language</Text>
            <Text style={styles.menuValue}>English</Text>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>RidesRus v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f3ee' },
  header: {
    paddingHorizontal: 24, paddingTop: Platform.OS === 'android' ? 40 : 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#eaeaea', backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#1a1a1a' },
  scrollContent: { padding: 24, paddingBottom: 100 },
  
  profileCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', 
    padding: 20, borderRadius: 20, marginBottom: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 5,
  },
  avatarContainer: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#facc15',
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  avatarInitials: { fontSize: 20, fontWeight: '900', color: '#1a1a1a' },
  profileInfo: { flex: 1 },
  userName: { fontSize: 18, fontWeight: '800', color: '#1a1a1a' },
  userEmail: { fontSize: 13, color: '#888', marginTop: 4 },
  editBtn: { padding: 8, backgroundColor: '#f4f2ee', borderRadius: 20 },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 12 },
  
  menuGroup: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#eaeaea' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#f5f3ee',
  },
  menuIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  menuValue: { fontSize: 14, color: '#888', marginRight: 8 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fee2e2', padding: 16, borderRadius: 16, marginTop: 40, gap: 8,
  },
  logoutText: { fontSize: 16, fontWeight: '800', color: '#ef4444' },
  
  versionText: { textAlign: 'center', fontSize: 12, color: '#aaa', marginTop: 24, fontWeight: '600' }
});
