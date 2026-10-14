import type { ExpoConfig } from 'expo/config';

/** Bus-mounted Android tablet (landscape, kiosk/screen-pinned). Also runs in a browser for the demo. */
const config: ExpoConfig = {
  name: 'RidesRus Console',
  slug: 'ridesrus-driver',
  scheme: 'ridesrus-driver',
  version: '3.0.0',
  orientation: 'landscape',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  ios: { bundleIdentifier: 'app.ridesrus.driver', supportsTablet: true, requireFullScreen: true },
  android: {
    package: 'app.ridesrus.driver',
    adaptiveIcon: { foregroundImage: './assets/icon.png', backgroundColor: '#FACC15' },
    permissions: ['ACCESS_FINE_LOCATION', 'WAKE_LOCK'],
  },
  web: { bundler: 'metro', output: 'single', favicon: './assets/icon.png' },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { image: './assets/splash.png', imageWidth: 180, backgroundColor: '#F7F5F0' }],
    'expo-secure-store',
    'expo-sqlite',
    [
      'expo-location',
      { locationWhenInUsePermission: 'The console reports the bus position so riders see it live on the map.' },
    ],
  ],
};

export default config;
