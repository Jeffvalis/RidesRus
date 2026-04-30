import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSignIn } from '@clerk/clerk-expo';
import { useOAuthFlow } from '../services/oauthFlow';

export const LoginScreen = ({ navigation }: any) => {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { handleOAuth } = useOAuthFlow();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!isLoaded) return;
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      // Step 1: find the account by email
      const signInAttempt = await signIn.create({
        identifier: email.trim().toLowerCase(),
      });

      // Step 2: verify password as the first factor
      if (signInAttempt.status === 'needs_first_factor') {
        const result = await signIn.attemptFirstFactor({
          strategy: 'password',
          password,
        });
        if (result.status === 'complete') {
          await setActive({ session: result.createdSessionId });
        } else {
          Alert.alert('Login issue', 'Could not complete sign-in. Please try again.');
        }
      } else if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId });
      } else {
        Alert.alert('Verification required', 'Please check your email for a verification link, then try again.');
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage || err?.message || 'Login failed.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>

        {/* Logo */}
        <View style={styles.topSection}>
          <View style={styles.iconContainer}>
            <Ionicons name="car" size={36} color="#1a1a1a" />
          </View>
          <Text style={styles.logoText}>RidesRus</Text>
          <Text style={styles.tagline}>Your city's pulse, in motion.</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>SIGN IN</Text>

          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={18} color="#888" style={{ marginRight: 10 }} />
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#888"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={18} color="#888" style={{ marginRight: 10 }} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#888"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity style={styles.ctaButton} onPress={handleLogin} disabled={loading || !isLoaded}>
            {loading ? <ActivityIndicator color="#4d400e" /> : <Text style={styles.ctaText}>Sign In</Text>}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialBtn} onPress={() => handleOAuth('google')}>
              <Ionicons name="logo-google" size={18} color="#4285F4" />
              <Text style={styles.socialBtnText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn} onPress={() => handleOAuth('apple')}>
              <Ionicons name="logo-apple" size={18} color="#1a1a1a" />
              <Text style={styles.socialBtnText}>Apple</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.newText}>New to RidesRus?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.createLink}>Create an account</Text>
          </TouchableOpacity>
          <View style={styles.supportRow}>
            <Text style={styles.supportLink}>SUPPORT</Text>
            <Text style={styles.supportDot}>•</Text>
            <Text style={styles.supportLink}>PRIVACY</Text>
          </View>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fdfbfa' },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  topSection: { alignItems: 'center', marginBottom: 40, marginTop: 40 },
  iconContainer: { width: 72, height: 72, backgroundColor: '#facc15', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: '#facc15', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  logoText: { fontSize: 36, fontWeight: '900', color: '#1a1a1a', letterSpacing: -1 },
  tagline: { fontSize: 16, color: '#666', marginTop: 4, fontWeight: '500' },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 30, elevation: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#555', letterSpacing: 0.8, marginBottom: 16 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f4f2ee', height: 56, borderRadius: 12, paddingHorizontal: 16, marginBottom: 16 },
  input: { flex: 1, fontSize: 16, color: '#1a1a1a', height: '100%' },
  ctaButton: { height: 56, backgroundColor: '#fcd34d', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  ctaText: { color: '#4d400e', fontSize: 16, fontWeight: '800' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: '#eaeaea' },
  dividerText: { fontSize: 10, fontWeight: '800', color: '#888', letterSpacing: 1, marginHorizontal: 14 },
  socialRow: { flexDirection: 'row', gap: 14 },
  socialBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, backgroundColor: '#f4f2ee', borderRadius: 12, gap: 8 },
  socialBtnText: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  footer: { alignItems: 'center', marginTop: 'auto', paddingBottom: 40 },
  newText: { fontSize: 14, color: '#666' },
  createLink: { fontSize: 15, fontWeight: '800', color: '#5b591b', marginTop: 4, marginBottom: 32 },
  supportRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  supportLink: { fontSize: 11, fontWeight: '800', color: '#888', letterSpacing: 1 },
  supportDot: { color: '#ccc', fontSize: 16 },
});
