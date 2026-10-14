import type { BusLiveDTO, LatLng, RouteDTO } from '@ridesrus/core';

export type BusMapProps = {
  route: RouteDTO | null;
  buses: BusLiveDTO[];
  rider: LatLng | null;
  riderStopId: string | null;
  /** The bus the rider has hailed or is riding — drawn emphasised. */
  focusBusId: string | null;
  selectedBusId: string | null;
  dropoffStopId: string | null;
  onSelectBus: (busId: string) => void;
  /** Extra space at the bottom of the map that the sheet covers. */
  bottomInset: number;
};
