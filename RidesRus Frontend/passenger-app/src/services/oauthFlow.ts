// OAuth via Google/Apple will be enabled in a future EAS build (Phase 2)
// For now, this is a no-op stub to prevent import errors in Expo Go
import { Alert } from 'react-native';

export function useOAuthFlow() {
  const handleOAuth = async (provider: 'google' | 'apple') => {
    Alert.alert(
      'Coming Soon',
      `${provider === 'google' ? 'Google' : 'Apple'} sign-in will be available in the next app update. Please use your phone number and password for now.`
    );
  };

  return { handleOAuth };
}
