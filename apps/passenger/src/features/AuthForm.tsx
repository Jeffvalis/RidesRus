import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, AuthResponse, LoginBody, PassengerDTO, RegisterPassengerBody } from '@ridesrus/core';
import { api } from '../lib/api';
import { useSession } from '../state/session';
import { Banner, Button, Field } from '../components/ui';
import { colors, type } from '../theme';

type Mode = 'sign-in' | 'register';

/**
 * Sign-in and registration. Validation uses the same zod contract as the API,
 * so a form that passes here won't be rejected by the server for shape.
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const insets = useSafeAreaInsets();
  const signIn = useSession((s) => s.signIn);
  const [values, setValues] = useState({ name: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const register = mode === 'register';

  const set = (k: keyof typeof values) => (v: string) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const submit = async () => {
    const schema = register ? RegisterPassengerBody : LoginBody;
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const path = register ? '/auth/passenger/register' : '/auth/passenger/login';
      await signIn(await api.post<AuthResponse<{ passenger: PassengerDTO }>>(path, parsed.data));
    } catch (err) {
      if (err instanceof ApiError && err.issues) {
        setErrors(Object.fromEntries(err.issues.map((i) => [i.path, i.message])));
      }
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={26} color={colors.ink} />
        </Pressable>
        <Text style={[type.display, { marginTop: 24 }]}>{register ? 'Create your account' : 'Welcome back'}</Text>
        <Text style={[type.body, { marginTop: 8 }]}>
          {register ? 'One account for every bus on the corridor.' : 'Sign in to hail, board and pay.'}
        </Text>

        <View style={{ gap: 16, marginTop: 28 }}>
          {register && (
            <Field label="Full name" icon="person" value={values.name} onChangeText={set('name')} error={errors.name} autoComplete="name" textContentType="name" placeholder="Ada Okafor" />
          )}
          <Field
            label="Email"
            icon="mail"
            value={values.email}
            onChangeText={set('email')}
            error={errors.email}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="you@example.com"
          />
          {register && (
            <Field label="Phone (optional)" icon="call" value={values.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" autoComplete="tel" placeholder="+234 803 000 0000" />
          )}
          <Field
            label="Password"
            icon="lock-closed"
            value={values.password}
            onChangeText={set('password')}
            error={errors.password}
            secureTextEntry
            autoComplete={register ? 'new-password' : 'current-password'}
            textContentType={register ? 'newPassword' : 'password'}
            placeholder={register ? 'At least 8 characters' : 'Your password'}
            onSubmitEditing={submit}
            returnKeyType="go"
          />
          {formError && <Banner tone="error" icon="alert-circle">{formError}</Banner>}
          <Button label={register ? 'Create account' : 'Sign in'} loading={busy} onPress={submit} />
          <Pressable onPress={() => router.replace(register ? '/sign-in' : '/register')} accessibilityRole="link" style={{ alignSelf: 'center', padding: 8 }}>
            <Text style={[type.body, { color: colors.olive, fontWeight: '700' }]}>
              {register ? 'Already riding with us? Sign in' : 'New to RidesRus? Create an account'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 24, maxWidth: 520, width: '100%', alignSelf: 'center' },
});
