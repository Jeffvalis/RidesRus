import { HttpException, Injectable } from '@nestjs/common';
import { DriverAction, DriverActionResult, LocationPing } from '@ridesrus/core';
import { DriverPrincipal } from '../auth/principal';
import { FleetStateService } from '../fleet/fleet-state.service';
import { NetworkService } from '../fleet/network.service';
import { HailsService } from '../journeys/hails.service';
import { TripsService } from '../journeys/trips.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../realtime/activity.service';
import { DriverStateService } from './driver-state.service';

/** Fixes older than this are history, not position — drop them rather than teleport the bus. */
const MAX_PING_AGE_MS = 60_000;

@Injectable()
export class DriverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fleet: FleetStateService,
    private readonly network: NetworkService,
    private readonly hails: HailsService,
    private readonly trips: TripsService,
    private readonly driverState: DriverStateService,
    private readonly activity: ActivityService,
  ) {}

  ingestLocation(driver: DriverPrincipal, ping: LocationPing): { ok: boolean; error?: string } {
    if (Date.now() - ping.at > MAX_PING_AGE_MS) return { ok: false, error: 'stale' };
    this.fleet.ingestGps(driver.busId, ping);
    return { ok: true };
  }

  /**
   * Replays actions from the tablet's offline queue, in order. Each action is
   * recorded under its idempotency key, so a retry after a dropped response
   * returns the original outcome instead of acting twice. Business-rule
   * failures (e.g. a hail that expired while offline) are reported but count
   * as processed, so one stale action can never block the rest of the queue.
   */
  async applyActions(driver: DriverPrincipal, actions: DriverAction[]): Promise<DriverActionResult[]> {
    const results: DriverActionResult[] = [];
    for (const action of actions) {
      const seen = await this.prisma.driverActionLog.findUnique({ where: { idempotencyKey: action.idempotencyKey } });
      if (seen) {
        results.push({ idempotencyKey: action.idempotencyKey, ok: seen.ok, error: seen.error ?? undefined, replayed: true });
        continue;
      }
      let ok = true;
      let error: string | undefined;
      try {
        if (action.type === 'ACK_HAIL') await this.hails.acknowledge(driver.busId, action.hailIds);
        if (action.type === 'ARRIVE_STOP') {
          this.network.stop(action.stopId);
          await this.trips.arriveAtStop(driver.busId, action.stopId);
        }
      } catch (err) {
        if (!(err instanceof HttpException)) throw err; // infrastructure failure → let the tablet retry later
        ok = false;
        error = err.message;
      }
      await this.prisma.driverActionLog.create({
        data: { idempotencyKey: action.idempotencyKey, shiftId: driver.shiftId, type: action.type, ok, error },
      });
      results.push({ idempotencyKey: action.idempotencyKey, ok, error, replayed: false });
    }
    this.driverState.publishSoon(driver.busId);
    return results;
  }

  async endShift(shiftId: string) {
    const shift = await this.prisma.shift.findUnique({ where: { id: shiftId }, include: { driver: true, bus: true } });
    if (!shift || shift.endedAt) return { ended: false };
    await this.prisma.shift.update({ where: { id: shiftId }, data: { endedAt: new Date() } });
    if (this.fleet.activeShiftId(shift.busId) === shiftId) this.fleet.setShift(shift.busId, null);
    this.activity.record('SHIFT', `${shift.driver.name} ended their shift on ${shift.bus.code}`, shift.bus.code);
    return { ended: true };
  }
}
