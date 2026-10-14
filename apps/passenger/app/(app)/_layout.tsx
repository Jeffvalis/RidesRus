import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLiveConnection } from '../../src/state/useLiveConnection';
import { useRiderLocation } from '../../src/state/useRiderLocation';
import { colors, fonts } from '../../src/theme';

type IconName = keyof typeof Ionicons.glyphMap;
const TAB_ICONS: Record<string, [IconName, IconName]> = {
  index: ['map', 'map-outline'],
  scan: ['qr-code', 'qr-code-outline'],
  wallet: ['wallet', 'wallet-outline'],
  account: ['person', 'person-outline'],
};

export default function AppLayout() {
  useLiveConnection();
  useRiderLocation();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.4 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 64, paddingTop: 6 },
        tabBarIcon: ({ focused, color, size }) => {
          const [on, off] = TAB_ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
          return <Ionicons name={focused ? on : off} size={size} color={focused ? colors.olive : color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Ride' }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan' }} />
      <Tabs.Screen name="wallet" options={{ title: 'Wallet' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
