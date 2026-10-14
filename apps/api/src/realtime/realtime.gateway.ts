import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { ClientToServerEvents, LocationPing, ServerToClientEvents } from '@ridesrus/core';
import type { Socket } from 'socket.io';
import { Principal } from '../auth/principal';
import { TokenService } from '../auth/token.service';
import { DriverStateService } from '../driver/driver-state.service';
import { DriverService } from '../driver/driver.service';
import { FleetStateService } from '../fleet/fleet-state.service';
import { PrismaService } from '../prisma/prisma.service';
import { IoServer, RealtimeService, rooms } from './realtime.service';

type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, { principal: Principal | null }>;

/**
 * One socket per app. Anyone may connect and watch the public fleet map; a
 * valid token (handshake `auth.token`) additionally joins the caller's private
 * room. CORS for sockets mirrors the HTTP allow-list (set in main.ts).
 */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger('Realtime');

  constructor(
    private readonly realtime: RealtimeService,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly fleet: FleetStateService,
    private readonly driver: DriverService,
    private readonly driverState: DriverStateService,
  ) {}

  afterInit(server: IoServer) {
    this.realtime.attach(server);
  }

  async handleConnection(socket: ClientSocket) {
    const principal = this.tokens.verify(socket.handshake.auth?.token as string | undefined);
    socket.data.principal = null;
    await socket.join(rooms.fleet);
    socket.emit('fleet:update', { buses: this.fleet.snapshot(), at: Date.now() });
    if (!principal) return;

    if (principal.role === 'driver') {
      const shift = await this.prisma.shift.findUnique({ where: { id: principal.shiftId } });
      if (!shift || shift.endedAt || shift.expiresAt < new Date()) return;
      await socket.join(rooms.bus(principal.busId));
      this.driverState.publishSoon(principal.busId);
    } else if (principal.role === 'passenger') {
      await socket.join(rooms.passenger(principal.sub));
    } else {
      await socket.join(rooms.admins);
    }
    socket.data.principal = principal;
  }

  @SubscribeMessage('driver:location')
  onLocation(@ConnectedSocket() socket: ClientSocket, @MessageBody() body: unknown) {
    const principal = socket.data.principal;
    if (principal?.role !== 'driver') return { ok: false, error: 'unauthorized' };
    const ping = LocationPing.safeParse(body);
    if (!ping.success) return { ok: false, error: 'invalid' };
    if (this.fleet.activeShiftId(principal.busId) !== principal.shiftId) return { ok: false, error: 'shift_ended' };
    return this.driver.ingestLocation(principal, ping.data);
  }
}
