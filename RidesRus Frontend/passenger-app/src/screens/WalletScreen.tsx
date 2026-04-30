import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const WalletScreen = () => {
  const transactions = [
    { id: 1, type: 'Ride Payment', desc: 'Lekki – Victoria Island', amount: -500, date: 'Today, 09:42 AM' },
    { id: 2, type: 'Wallet Top-up', desc: 'Card ending in •••• 4242', amount: 5000, date: 'Yesterday, 14:15 PM' },
    { id: 3, type: 'Ride Payment', desc: 'Ajah – Lekki Phase 1', amount: -500, date: 'Oct 12, 18:30 PM' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wallet</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceAmount}>₦4,500.00</Text>
          <TouchableOpacity style={styles.topUpBtn}>
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.topUpText}>Top up</Text>
          </TouchableOpacity>
        </View>

        {/* Payment Methods */}
        <Text style={styles.sectionTitle}>Payment Methods</Text>
        <View style={styles.cardInfo}>
          <View style={styles.cardLeft}>
            <Ionicons name="card" size={24} color="#1a1a1a" />
            <View>
              <Text style={styles.cardName}>Mastercard</Text>
              <Text style={styles.cardNumber}>•••• •••• •••• 4242</Text>
            </View>
          </View>
          <TouchableOpacity>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.addCardBtn}>
          <Ionicons name="add" size={20} color="#5b591b" />
          <Text style={styles.addCardText}>Add New Card</Text>
        </TouchableOpacity>

        {/* Recent Transactions */}
        <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Recent Transactions</Text>
        <View style={styles.transactionsList}>
          {transactions.map(tx => (
            <View key={tx.id} style={styles.txItem}>
              <View style={[styles.txIcon, { backgroundColor: tx.amount > 0 ? '#dcfce7' : '#fef2f2' }]}>
                <Ionicons 
                  name={tx.amount > 0 ? 'arrow-down' : 'car'} 
                  size={18} 
                  color={tx.amount > 0 ? '#15803d' : '#ef4444'} 
                />
              </View>
              <View style={styles.txDetails}>
                <Text style={styles.txType}>{tx.type}</Text>
                <Text style={styles.txDesc}>{tx.desc}</Text>
              </View>
              <View style={styles.txRight}>
                <Text style={[styles.txAmount, { color: tx.amount > 0 ? '#15803d' : '#1a1a1a' }]}>
                  {tx.amount > 0 ? '+' : ''}₦{Math.abs(tx.amount)}
                </Text>
                <Text style={styles.txDate}>{tx.date}</Text>
              </View>
            </View>
          ))}
        </View>
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
  
  balanceCard: {
    backgroundColor: '#1a1a1a', borderRadius: 20, padding: 24, marginBottom: 32,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  balanceLabel: { color: '#aaa', fontSize: 14, fontWeight: '600' },
  balanceAmount: { color: '#fff', fontSize: 36, fontWeight: '900', marginVertical: 8 },
  topUpBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: '#5b591b', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 12, gap: 6,
  },
  topUpText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginBottom: 16 },
  
  cardInfo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#eaeaea',
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  cardNumber: { fontSize: 13, color: '#888', marginTop: 2 },
  addCardBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f2efea', padding: 16, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ccc', gap: 8,
  },
  addCardText: { fontSize: 14, fontWeight: '700', color: '#5b591b' },

  transactionsList: { backgroundColor: '#fff', borderRadius: 16, padding: 8, borderWidth: 1, borderColor: '#eaeaea' },
  txItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f5f3ee' },
  txIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txDetails: { flex: 1 },
  txType: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  txDesc: { fontSize: 12, color: '#888', marginTop: 2 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 15, fontWeight: '800' },
  txDate: { fontSize: 11, color: '#aaa', marginTop: 2 },
});
