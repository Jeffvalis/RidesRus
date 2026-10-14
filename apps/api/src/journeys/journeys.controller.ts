import { Body, Controller, Get, Inject, Param, Post, Put } from '@nestjs/common';
import { BoardBody, CreateHailBody, ErrorCodes, RateTripBody, SetDropoffBody } from '@ridesrus/core';
import { CurrentUser, PassengerPrincipal, Roles } from '../auth/principal';
import { AppError, notFound } from '../common/errors';
import { ZodPipe } from '../common/zod.pipe';
import { APP_CONFIG, AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { HailsService } from './hails.service';
import { QrService } from './qr.service';
import { TripsService } from './trips.service';

@Controller()
@Roles('passenger')
export class JourneysController {
  constructor(
    private readonly hails: HailsService,
    private readonly trips: TripsService,
    private readonly qr: QrService,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('me/journey')
  active(@CurrentUser() user: PassengerPrincipal) {
    return this.trips.active(user.sub);
  }

  @Get('me/trips')
  history(@CurrentUser() user: PassengerPrincipal) {
    return this.trips.history(user.sub);
  }

  @Post('hails')
  hail(@CurrentUser() user: PassengerPrincipal, @Body(new ZodPipe(CreateHailBody)) body: CreateHailBody) {
    return this.hails.create(user.sub, body);
  }

  @Post('hails/:id/cancel')
  cancelHail(@CurrentUser() user: PassengerPrincipal, @Param('id') id: string) {
    return this.hails.cancel(user.sub, id);
  }

  @Post('boardings')
  board(@CurrentUser() user: PassengerPrincipal, @Body(new ZodPipe(BoardBody)) body: BoardBody) {
    return this.trips.board(user.sub, body);
  }

  @Put('trips/:id/dropoff')
  dropoff(@CurrentUser() user: PassengerPrincipal, @Param('id') id: string, @Body(new ZodPipe(SetDropoffBody)) body: SetDropoffBody) {
    return this.trips.setDropoff(user.sub, id, body.stopId);
  }

  @Post('trips/:id/rating')
  rate(@CurrentUser() user: PassengerPrincipal, @Param('id') id: string, @Body(new ZodPipe(RateTripBody)) body: RateTripBody) {
    return this.trips.rate(user.sub, id, body);
  }

  /**
   * DEMO ONLY. In a browser demo there's no physical bus screen to point a camera
   * at, so this hands the rider the code their hailed bus is currently showing.
   * Requires an active hail on that bus; returns 404 unless DEMO_MODE=true.
   */
  @Post('demo/scan')
  async demoScan(@CurrentUser() user: PassengerPrincipal) {
    if (!this.config.DEMO_MODE) throw notFound('Route');
    const hail = await this.prisma.hail.findFirst({
      where: { passengerId: user.sub, status: { in: ['PENDING', 'ACKNOWLEDGED'] } },
    });
    if (!hail) throw new AppError(ErrorCodes.VALIDATION, 'Hail a bus first, then simulate the scan.');
    return this.qr.issue(hail.busId);
  }
}
