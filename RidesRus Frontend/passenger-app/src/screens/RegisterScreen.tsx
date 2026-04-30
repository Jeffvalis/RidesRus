import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSignUp } from '@clerk/clerk-expo';
import { useOAuthFlow } from '../services/oauthFlow';

export const RegisterScreen = ({ navigation }: any) => {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { handleOAuth } = useOAuthFlow();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!isLoaded) return;
    if (!firstName || !email || !password) {
      Alert.alert('Missing fields', 'Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      const result = await signUp.create({
        firstName,
        lastName: lastName || undefined,
        emailAddress: email.trim().toLowerCase(),
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        // ClerkProvider auth gate redirects to Main automatically
      } else {
        Alert.alert('Almost there', 'Account created — please sign in to continue.');
        navigation.navigate('Login');
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage || err?.message || 'Registration failed.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logoText}>RidesRus</Text>
            <View style={styles.headerRight}>
              <Text style={styles.loginText}>Already a member?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}> Log in</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Join the future of urban mobility today.</Text>

            {/* Social quick options */}
            <View style={styles.socialRow}>
              <TouchableOpacity style={[styles.socialBtn, styles.googleBtn]} onPress={() => handleOAuth('google')}>
                <Ionicons name="logo-google" size={16} color="#4285F4" />
                <Text style={styles.googleBtnText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.socialBtn, styles.appleBtn]} onPress={() => handleOAuth('apple')}>
                <Ionicons name="logo-apple" size={16} color="#fff" />
                <Text style={styles.appleBtnText}>Apple</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>OR SIGN UP WITH PHONE</Text>
              <View style={styles.divider} />
            </View>

            {/* Form */}
            <View style={styles.formRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>FIRST NAME *</Text>
                <TextInput style={styles.input2} placeholder="Tunde" placeholderTextColor="#aaa" value={firstName} onChangeText={setFirstName} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>LAST NAME</Text>
                <TextInput style={styles.input2} placeholder="Bakare" placeholderTextColor="#aaa" value={lastName} onChangeText={setLastName} />
              </View>
            </View>

            <View style={[styles.inputGroup, { marginTop: 20 }]}>
              <Text style={styles.label}>EMAIL ADDRESS *</Text>
              <TextInput
                style={styles.input2}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#aaa"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={[styles.inputGroup, { marginTop: 20 }]}>
              <Text style={styles.label}>PASSWORD *</Text>
              <TextInput style={styles.input2} placeholder="Min. 8 characters" secureTextEntry placeholderTextColor="#aaa" value={password} onChangeText={setPassword} />
            </View>

            <TouchableOpacity style={styles.ctaButton} onPress={handleRegister} disabled={loading || !isLoaded}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Create Account</Text>}
            </TouchableOpacity>

            <Text style={styles.termsText}>
              By continuing, you agree to RidesRus's <Text style={styles.termsLink}>Terms of Service</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#faf9f5' },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  topSection: { alignItems: 'center', marginBottom: 32, marginTop: 48, paddingHorizontal: 24 },
  iconContainer: { width: 64, height: 64, backgroundColor: '#facc15', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 14, shadowColor: '#facc15', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16 },
  logoText: { fontSize: 22, fontWeight: '900', color: '#1a1a1a' },
  tagline: { fontSize: 14, color: '#666', marginTop: 6, textAlign: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  loginText: { fontSize: 13, color: '#666', fontWeight: '500' },
  loginLink: { fontSize: 13, color: '#5b591b', fontWeight: '800' },
  content: { flex: 1, paddingHorizontal: 24, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: '900', color: '#1a1a1a', marginTop: 24 },
  subtitle: { fontSize: 14, color: '#666', marginTop: 6, marginBottom: 28 },
  formRow: { flexDirection: 'row', gap: 14 },
  inputGroup: { flex: 1, gap: 8 },
  label: { fontSize: 11, fontWeight: '800', color: '#555', letterSpacing: 0.5 },
  input2: { backgroundColor: '#f2efea', height: 52, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, color: '#1a1a1a' },
  phoneInputContainer: { flexDirection: 'row', backgroundColor: '#f2efea', height: 52, borderRadius: 12, alignItems: 'center', paddingHorizontal: 16 },
  countryCode: { fontSize: 15, fontWeight: '700', color: '#555', marginRight: 10 },
  inputRaw: { flex: 1, fontSize: 15, color: '#1a1a1a', height: '100%' },
  ctaButton: { height: 56, backgroundColor: '#5b591b', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 32, marginBottom: 20, shadowColor: '#5b591b', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 5 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  termsText: { fontSize: 12, color: '#888', textAlign: 'center', lineHeight: 18 },
  termsLink: { fontWeight: '700', color: '#5b591b' },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 24, marginHorizontal: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 30, elevation: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#555', letterSpacing: 0.8, marginBottom: 16 },
  socialBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 12, marginBottom: 0, gap: 8 },
  socialRow: { flexDirection: 'row', gap: 14, marginBottom: 24 },
  googleBtn: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  googleBtnText: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  appleBtn: { backgroundColor: '#1a1a1a' },
  appleBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  divider: { flex: 1, height: 1, backgroundColor: '#eaeaea' },
  dividerText: { fontSize: 10, fontWeight: '800', color: '#888', letterSpacing: 1, marginHorizontal: 12 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f4f2ee', height: 56, borderRadius: 12, paddingHorizontal: 16, marginBottom: 16 },
  input: { flex: 1, fontSize: 16, color: '#1a1a1a', height: '100%' },
  backBtn: { alignItems: 'center', marginTop: 12 },
  backBtnText: { color: '#888', fontSize: 14, fontWeight: '600' },
});
