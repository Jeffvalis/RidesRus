import { ApiClient } from '@ridesrus/core';
import { useSession } from '../state/session';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3005').replace(/\/$/, '');

export const api = new ApiClient({
  baseUrl: API_URL,
  getToken: () => useSession.getState().session?.token,
  onUnauthorized: () => {
    if (useSession.getState().session) void useSession.getState().signOut();
  },
});
