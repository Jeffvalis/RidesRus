import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { BoardingService } from './boarding.service';

@Controller('boarding')
export class BoardingController {
  constructor(private readonly boardingService: BoardingService) {}

  /**
   * GET /boarding/qr?busId=xxx
   * Driver tablet calls this to get a QR code to display.
   */
  @Get('qr')
  generateQR(@Query('busId') busId: string) {
    return this.boardingService.generateBusQR(busId);
  }

  /**
   * POST /boarding/scan
   * Passenger scans QR → deducts fare → creates trip → decrements seats.
   */
  @Post('scan')
  processBoarding(@Body() body: { userId: string; qrPayload: string }) {
    return this.boardingService.processBoarding(body.userId, body.qrPayload);
  }

  /**
   * POST /boarding/select-stop
   * Passenger selects their drop-off stop after boarding.
   */
  @Post('select-stop')
  selectStop(@Body() body: { tripId: string; destinationStation: string }) {
    return this.boardingService.selectDropOff(body.tripId, body.destinationStation);
  }

  /**
   * POST /boarding/complete
   * Completes trip when the passenger reaches their stop.
   */
  @Post('complete')
  completeTrip(@Body() body: { tripId: string }) {
    return this.boardingService.completeTrip(body.tripId);
  }
}
