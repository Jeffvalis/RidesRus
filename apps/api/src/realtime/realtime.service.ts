import { Injectable } from '@nestjs/common';
import type { ServerToClientEvents, ClientToServerEvents } from '@ridesrus/core';
import type { Server } from 'socket.io';

export type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
type EventName = keyof ServerToClientEvents;
type Payload<E extends EventName> = Parameters<ServerToClientEvents[E]>[0];

/**
 * Room layout:
 *   fleet              – everyone (public bus positions, no personal data)
 *   passenger:{id}     – one rider's devices
 *   bus:{busId}        – the tablet on that bus
 *   admins             – Fleet HQ dashboards
 */
export const rooms = {
  fleet: 'fleet',
  passenger: (id: string) => `passenger:${id}`,
  bus: (id: string) => `bus:${id}`,
  admins: 'admins',
};

@Injectable()
export class RealtimeService {
  private io: IoServer | null = null;

  attach(io: IoServer) {
    this.io = io;
  }

  emit<E extends EventName>(room: string, event: E, payload: Payload<E>) {
    if (!this.io) return;
    // Socket.IO's emit generics can't resolve a generic E; this method's own
    // signature is what keeps every call site type-checked.
    const target = this.io.to(room) as unknown as { emit: (e: string, p: unknown) => void };
    target.emit(event, payload);
  }

  toPassenger<E extends EventName>(id: string, event: E, payload: Payload<E>) {
    this.emit(rooms.passenger(id), event, payload);
  }

  toBus<E extends EventName>(busId: string, event: E, payload: Payload<E>) {
    this.emit(rooms.bus(busId), event, payload);
  }

  toAdmins<E extends EventName>(event: E, payload: Payload<E>) {
    this.emit(rooms.admins, event, payload);
  }

  toFleet<E extends EventName>(event: E, payload: Payload<E>) {
    this.emit(rooms.fleet, event, payload);
  }
}
