import { DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { TokenService } from './auth/token.service';
import { ApiExceptionFilter } from './common/errors';
import { APP_CONFIG, AppConfig } from './config';
import { AutopilotService } from './demo/autopilot.service';
import { DriverStateService } from './driver/driver-state.service';
import { DriverController } from './driver/driver.controller';
import { DriverService } from './driver/driver.service';
import { FleetStateService } from './fleet/fleet-state.service';
import { NetworkController } from './fleet/network.controller';
import { NetworkService } from './fleet/network.service';
import { HailsService } from './journeys/hails.service';
import { JourneysController } from './journeys/journeys.controller';
import { QrService } from './journeys/qr.service';
import { TripsService } from './journeys/trips.service';
import { PrismaService } from './prisma/prisma.service';
import { ActivityService } from './realtime/activity.service';
import { RealtimeGateway } from './realtime/realtime.gateway';
import { RealtimeService } from './realtime/realtime.service';
import { FlutterwaveProvider } from './wallet/flutterwave.provider';
import { LedgerService } from './wallet/ledger.service';
import { PAYMENT_PROVIDER } from './wallet/payment-provider';
import { SandboxProvider } from './wallet/sandbox.provider';
import { TopUpsService } from './wallet/topups.service';
import { WalletController } from './wallet/wallet.controller';

/**
 * One deployable module. The domain is small enough that splitting it into
 * Nest feature modules would add wiring without adding boundaries; the folders
 * (auth, fleet, journeys, wallet, driver, admin, realtime, demo) are the seams
 * to cut along if it grows.
 */
@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: config.NODE_ENV === 'test' ? 10_000 : 300 }])],
      controllers: [
        AuthController,
        NetworkController,
        JourneysController,
        WalletController,
        DriverController,
        AdminController,
      ],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        {
          provide: PAYMENT_PROVIDER,
          useFactory: () =>
            config.PAYMENTS_PROVIDER === 'flutterwave'
              ? new FlutterwaveProvider(config.FLW_SECRET_KEY!, config.FLW_WEBHOOK_HASH!, config.FLW_REDIRECT_URL)
              : new SandboxProvider(config.PUBLIC_API_URL),
        },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        PrismaService,
        TokenService,
        AuthService,
        RealtimeService,
        RealtimeGateway,
        ActivityService,
        NetworkService,
        FleetStateService,
        QrService,
        HailsService,
        TripsService,
        LedgerService,
        TopUpsService,
        DriverStateService,
        DriverService,
        AdminService,
        AutopilotService,
      ],
    };
  }
}
