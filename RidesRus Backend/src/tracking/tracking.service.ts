import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class TrackingService implements OnModuleInit, OnModuleDestroy {
  public redisClient: Redis;

  onModuleInit() {
    // If no Redis URL is provided, try connecting to localhost default port 6379 natively.
    this.redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  onModuleDestroy() {
    this.redisClient.disconnect();
  }

  async updateBusLocation(busId: string, lat: number, lng: number) {
    // We store as a hash (or geo add)
    await this.redisClient.hset(`bus:${busId}`, { lat, lng, lastUpdate: Date.now() });
    
    // Also add to a geo index if we want geospatial queries later:
    // This allows passengers to "find nearby buses"
    await this.redisClient.geoadd('buses_geo', lng, lat, busId);
  }

  async getBusLocation(busId: string) {
    return this.redisClient.hgetall(`bus:${busId}`);
  }

  async getAllBusesNearby(lat: number, lng: number, radiusKm: number = 10) {
    // Returns busIds within radius
    return this.redisClient.geosearch(
        'buses_geo',
        'FROMLONLAT', lng, lat,
        'BYRADIUS', radiusKm, 'km',
        'WITHDIST'
    );
  }
}
