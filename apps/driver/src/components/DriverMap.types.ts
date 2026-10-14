import type { RouteDTO } from '@ridesrus/core';

export type DriverMapProps = {
  route: RouteDTO | null;
  bus: { lat: number; lng: number; heading: number } | null;
  pickupStopIds: string[];
  dropoffStopIds: string[];
  night: boolean;
};
