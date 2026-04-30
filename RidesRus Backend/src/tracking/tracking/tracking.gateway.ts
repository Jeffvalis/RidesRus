import { 
  WebSocketGateway, 
  SubscribeMessage, 
  MessageBody, 
  WebSocketServer, 
  ConnectedSocket, 
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TrackingService } from '../tracking.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly trackingService: TrackingService) {}

  handleConnection(client: Socket) {
    console.log(`Client Connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client Disconnected: ${client.id}`);
  }

  // Driver sends their GPS location every 5 seconds
  @SubscribeMessage('ping_location')
  async handleLocationPing(
    @MessageBody() data: { busId: string, lat: number, lng: number },
    @ConnectedSocket() client: Socket
  ) {
    // 1. Save in redis
    await this.trackingService.updateBusLocation(data.busId, data.lat, data.lng);

    // 2. Broadcast to all passengers listening to "live_map"
    // To scale this later, we can broadcast to geo-fenced rooms instead of globally
    this.server.emit('bus_moved', {
      busId: data.busId,
      lat: data.lat,
      lng: data.lng,
      timestamp: Date.now()
    });

    return { status: 'ok' };
  }

  // Passenger hails a bus
  @SubscribeMessage('hail_bus')
  async handleHailBus(
    @MessageBody() data: { busId: string, passengerId: string, userLat: number, userLng: number },
    @ConnectedSocket() client: Socket
  ) {
    // Alert the specific driver by emitting to their unique bus room
    this.server.to(`driver_${data.busId}`).emit('new_hail', {
      passengerId: data.passengerId,
      lat: data.userLat,
      lng: data.userLng
    });
    return { status: 'hail_sent' };
  }

  // Driver joins their specific room on login
  @SubscribeMessage('driver_online')
  handleDriverOnline(
    @MessageBody() data: { busId: string },
    @ConnectedSocket() client: Socket
  ) {
    client.join(`driver_${data.busId}`);
    return { status: 'driver_joined_room' };
  }

  // Passenger confirms stop after payment — alert driver console
  @SubscribeMessage('passenger_stop_selected')
  handlePassengerStop(
    @MessageBody() data: { busId: string; passengerId: string; stopName: string; fare: number },
    @ConnectedSocket() client: Socket
  ) {
    console.log(`[Gateway] Passenger stop selected: ${data.stopName} on bus ${data.busId}`);
    this.server.to(`driver_${data.busId}`).emit('stop_update', {
      passengerId: data.passengerId,
      stopName: data.stopName,
      fare: data.fare,
      timestamp: Date.now(),
    });
    return { status: 'stop_noted' };
  }
}
