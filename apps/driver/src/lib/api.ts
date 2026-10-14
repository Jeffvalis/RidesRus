import { ApiClient } from '@ridesrus/core';
import { useShift } from '../state/shift';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3005').replace(/\/$/, '');

export const api = new ApiClient({
  baseUrl: API_URL,
  getToken: () => useShift.getState().shift?.token,
  onUnauthorized: () => {
    if (useShift.getState().shift) void useShift.getState().end();
  },
});
