import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { LatLng, RouteDTO, RouteGeometry } from '@ridesrus/core';
import { notFound } from '../common/errors';
import { APP_CONFIG, AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';

export type BusInfo = { id: string; code: string; plate: string; capacity: number; routeId: string };
export type StopInfo = { id: string; name: string; lat: number; lng: number; seq: number; routeId: string };

/**
 * Read-mostly network data (routes, stops, buses) cached in memory at boot.
 * Routes and buses change rarely; call `reload()` after an admin edits them.
 */
@Injectable()
export class NetworkService implements OnModuleInit {
  private routes = new Map<string, { dto: RouteDTO; geometry: RouteGeometry }>();
  private stops = new Map<string, StopInfo>();
  private buses = new Map<string, BusInfo>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async onModuleInit() {
    await this.reload();
  }

  async reload() {
    const [routes, buses] = await Promise.all([
      this.prisma.route.findMany({ include: { stops: { orderBy: { seq: 'asc' } } } }),
      this.prisma.bus.findMany(),
    ]);
    this.routes.clear();
    this.stops.clear();
    for (const r of routes) {
      const path = r.path as LatLng[];
      // Demo autopilot runs faster than real time; ETAs use the same clock so they stay truthful on screen.
      const avgSpeedMps = r.avgSpeedMps * (this.config.DEMO_MODE ? this.config.DEMO_SPEEDUP : 1);
      const dto: RouteDTO = {
        id: r.id,
        avgSpeedMps,
        code: r.code,
        name: r.name,
        fareKobo: r.fareKobo,
        path,
        stops: r.stops.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, seq: s.seq })),
      };
      this.routes.set(r.id, { dto, geometry: new RouteGeometry({ stops: dto.stops, path, avgSpeedMps }) });
      for (const s of r.stops) this.stops.set(s.id, { ...s, routeId: r.id });
    }
    this.buses = new Map(buses.map((b) => [b.id, { id: b.id, code: b.code, plate: b.plate, capacity: b.capacity, routeId: b.routeId }]));
  }

  allRoutes(): RouteDTO[] {
    return [...this.routes.values()].map((r) => r.dto);
  }

  route(routeId: string) {
    const r = this.routes.get(routeId);
    if (!r) throw notFound('Route');
    return r;
  }

  geometryForBus(busId: string): RouteGeometry {
    return this.route(this.bus(busId).routeId).geometry;
  }

  bus(busId: string): BusInfo {
    const b = this.buses.get(busId);
    if (!b) throw notFound('Bus');
    return b;
  }

  hasBus(busId: string) {
    return this.buses.has(busId);
  }

  allBuses(): BusInfo[] {
    return [...this.buses.values()];
  }

  stop(stopId: string): StopInfo {
    const s = this.stops.get(stopId);
    if (!s) throw notFound('Stop');
    return s;
  }

  stopName(stopId: string | null | undefined): string | null {
    return stopId ? (this.stops.get(stopId)?.name ?? null) : null;
  }
}
