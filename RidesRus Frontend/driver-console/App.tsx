import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import { LoginScreen } from './src/screens/LoginScreen';
import { ConsoleScreen } from './src/screens/ConsoleScreen';
import { initOfflineDB } from './src/queue/offlineQueue';

// Mapbox token set handled inside ConsoleScreen when native

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    initOfflineDB().catch(console.error);
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Console" component={ConsoleScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
