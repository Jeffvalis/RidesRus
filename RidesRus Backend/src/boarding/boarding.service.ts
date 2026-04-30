import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from '../payment/payment.service';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BoardingService {
  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
  ) {}

  /**
   * Generate a unique QR code string for a specific bus.
   * The QR encodes a JSON payload the passenger app will scan.
   * Drivers display this QR on their mounted tablet.
   */
  async generateBusQR(busId: string) {
    const bus = await this.prisma.bus.findUnique({
      where: { id: busId },
      include: { route: true },
    });

    if (!bus) throw new BadRequestException('Bus not found');

    const qrPayload = JSON.stringify({
      busId: bus.id,
      routeId: bus.currentRouteId,
      routeName: bus.route?.name || 'Unknown Route',
      fare: bus.route?.baseFare || 0,
      timestamp: Date.now(),
    });

    // Generate QR code as base64 data URL (displayed on driver tablet)
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    return { qrDataUrl, qrPayload };
  }

  /**
   * Process a QR scan from the passenger app.
   * 1. Parse the QR payload
   * 2. Deduct fare from wallet
   * 3. Create trip record
   * 4. Decrement available seats on the bus
   */
  async processBoarding(userId: string, qrPayload: string) {
    let parsed: any;
    try {
      parsed = JSON.parse(qrPayload);
    } catch {
      throw new BadRequestException('Invalid QR code');
    }

    const { busId, fare } = parsed;

    if (!busId || fare === undefined) {
      throw new BadRequestException('QR code missing required data');
    }

    // Check bus exists and has seats
    const bus = await this.prisma.bus.findUnique({ where: { id: busId } });
    if (!bus) throw new BadRequestException('Bus not found');
    if (bus.availableSeats <= 0) throw new BadRequestException('Bus is full');

    // Deduct fare from user wallet (this also creates the trip)
    const result = await this.paymentService.deductTripFare(userId, fare, busId);

    // Decrement available seats
    await this.prisma.bus.update({
      where: { id: busId },
      data: { availableSeats: { decrement: 1 } },
    });

    return {
      message: 'Boarding successful! Welcome aboard.',
      tripId: result.tripId,
      walletBalance: result.walletBalance,
      seatsRemaining: bus.availableSeats - 1,
    };
  }

  /**
   * Passenger selects their drop-off stop after boarding.
   */
  async selectDropOff(tripId: string, destinationStation: string) {
    const trip = await this.prisma.trip.update({
      where: { id: tripId },
      data: { destinationStation },
    });

    return { message: 'Drop-off stop selected', trip };
  }

  /**
   * Complete a trip when the passenger reaches their stop.
   * Increments available seats back on the bus.
   */
  async completeTrip(tripId: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new BadRequestException('Trip not found');

    const [updatedTrip] = await this.prisma.$transaction([
      this.prisma.trip.update({
        where: { id: tripId },
        data: { status: 'COMPLETED' },
      }),
      this.prisma.bus.update({
        where: { id: trip.busId },
        data: { availableSeats: { increment: 1 } },
      }),
    ]);

    return { message: 'Trip completed. Thank you for riding with RidesRus!', trip: updatedTrip };
  }
}
