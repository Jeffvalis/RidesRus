import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useConsole } from '../src/state/console';
import { useShift } from '../src/state/shift';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  useKeepAwake(); // a mounted console must never sleep mid-route
  const [fontsLoaded] = useFonts({ PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  const status = useShift((s) => s.status);
  const night = useConsole((s) => s.night);

  useEffect(() => {
    void useShift.getState().hydrate();
  }, []);
  const ready = fontsLoaded && status !== 'loading';
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style={night ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Protected guard={status === 'on'}>
          <Stack.Screen name="index" />
        </Stack.Protected>
        <Stack.Protected guard={status !== 'on'}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </SafeAreaProvider>
  );
}
