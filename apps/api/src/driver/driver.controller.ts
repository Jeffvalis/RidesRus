import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DriverActionsBody, DriverQrDTO, DriverStateDTO, LocationPing } from '@ridesrus/core';
import { CurrentUser, DriverPrincipal, Roles } from '../auth/principal';
import { ZodPipe } from '../common/zod.pipe';
import { QrService } from '../journeys/qr.service';
import { DriverStateService } from './driver-state.service';
import { DriverService } from './driver.service';

@Controller('driver')
@Roles('driver')
@SkipThrottle()
export class DriverController {
  constructor(
    private readonly driver: DriverService,
    private readonly state: DriverStateService,
    private readonly qr: QrService,
  ) {}

  @Get('state')
  async getState(@CurrentUser() user: DriverPrincipal): Promise<DriverStateDTO | null> {
    return this.state.build(user.busId);
  }

  /** The tablet refreshes this every window; the code it shows is what passengers scan. */
  @Get('qr')
  getQr(@CurrentUser() user: DriverPrincipal): DriverQrDTO {
    return this.qr.issue(user.busId);
  }

  @Post('actions')
  @HttpCode(200)
  actions(@CurrentUser() user: DriverPrincipal, @Body(new ZodPipe(DriverActionsBody)) body: DriverActionsBody) {
    return this.driver.applyActions(user, body.actions);
  }

  /** HTTP fallback for GPS when the socket is down (the tablet batches the latest fix). */
  @Post('location')
  @HttpCode(200)
  location(@CurrentUser() user: DriverPrincipal, @Body(new ZodPipe(LocationPing)) ping: LocationPing) {
    return this.driver.ingestLocation(user, ping);
  }

  @Post('shift/end')
  @HttpCode(200)
  endShift(@CurrentUser() user: DriverPrincipal) {
    return this.driver.endShift(user.shiftId);
  }
}
