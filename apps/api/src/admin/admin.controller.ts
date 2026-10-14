import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CreateDriverBody, IssueShiftKeyBody } from '@ridesrus/core';
import { Roles } from '../auth/principal';
import { ZodPipe } from '../common/zod.pipe';
import { DriverService } from '../driver/driver.service';
import { TripsService } from '../journeys/trips.service';
import { ActivityService } from '../realtime/activity.service';
import { AdminService } from './admin.service';

@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly trips: TripsService,
    private readonly driver: DriverService,
    private readonly activity: ActivityService,
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('activity')
  recentActivity() {
    return this.activity.recent();
  }

  @Get('drivers')
  drivers() {
    return this.admin.drivers();
  }

  @Post('drivers')
  createDriver(@Body(new ZodPipe(CreateDriverBody)) body: CreateDriverBody) {
    return this.admin.createDriver(body);
  }

  @Post('drivers/:id/shift-keys')
  issueShiftKey(@Param('id') id: string, @Body(new ZodPipe(IssueShiftKeyBody)) body: IssueShiftKeyBody) {
    return this.admin.issueShiftKey(id, body.busId);
  }

  @Get('buses')
  buses() {
    return this.admin.busesWithDrivers();
  }

  @Get('trips')
  tripLog() {
    return this.admin.trips();
  }

  @Post('trips/:id/void')
  @HttpCode(200)
  voidTrip(@Param('id') id: string) {
    return this.trips.void(id);
  }

  @Post('shifts/:id/end')
  @HttpCode(200)
  endShift(@Param('id') id: string) {
    return this.driver.endShift(id);
  }
}
