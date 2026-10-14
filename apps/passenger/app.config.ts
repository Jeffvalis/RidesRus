import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'RidesRus',
  slug: 'ridesrus-passenger',
  scheme: 'ridesrus',
  version: '3.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  ios: {
    bundleIdentifier: 'app.ridesrus.passenger',
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: 'RidesRus uses the camera to scan the boarding code on the bus.',
      NSLocationWhenInUseUsageDescription: 'RidesRus uses your location to find the nearest stop and buses heading your way.',
    },
  },
  android: {
    package: 'app.ridesrus.passenger',
    adaptiveIcon: { foregroundImage: './assets/icon.png', backgroundColor: '#FACC15' },
    permissions: ['CAMERA', 'ACCESS_FINE_LOCATION'],
    // Google Maps on Android needs a key; iOS uses Apple Maps and web uses OpenStreetMap tiles.
    config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY } },
  },
  web: { bundler: 'metro', output: 'single', favicon: './assets/icon.png' },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { image: './assets/splash.png', imageWidth: 180, backgroundColor: '#F7F5F0' }],
    'expo-secure-store',
    ['expo-camera', { cameraPermission: 'RidesRus uses the camera to scan the boarding code on the bus.' }],
    ['expo-location', { locationWhenInUsePermission: 'RidesRus uses your location to find the nearest stop.' }],
  ],
  experiments: { typedRoutes: false },
};

export default config;
