import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { BusLiveDTO, RouteDTO } from '@ridesrus/core';
import { APP_CONFIG, AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { FleetStateService } from './fleet-state.service';
import { NetworkService } from './network.service';

@Controller()
@SkipThrottle()
export class NetworkController {
  constructor(
    private readonly network: NetworkService,
    private readonly fleet: FleetStateService,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('routes')
  routes(): RouteDTO[] {
    return this.network.allRoutes();
  }

  @Get('fleet')
  fleetSnapshot(): BusLiveDTO[] {
    return this.fleet.snapshot();
  }

  /** Lets the apps adapt their UI (demo helpers, payment copy) without a rebuild. */
  @Get('config')
  clientConfig() {
    return {
      demoMode: this.config.DEMO_MODE,
      payments: this.config.PAYMENTS_PROVIDER,
    };
  }

  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, buses: this.fleet.snapshot().length, at: Date.now() };
  }
}
