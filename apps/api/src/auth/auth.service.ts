import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import {
  AuthResponse,
  DriverLoginBody,
  ErrorCodes,
  LoginBody,
  PassengerDTO,
  RegisterPassengerBody,
  naira,
} from '@ridesrus/core';
import { AppError, conflict, notFound } from '../common/errors';
import { APP_CONFIG, AppConfig } from '../config';
import { FleetStateService } from '../fleet/fleet-state.service';
import { Passenger } from '../generated/prisma/client';
import { isUniqueViolation } from '../journeys/mappers';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../realtime/activity.service';
import { TopUpsService } from '../wallet/topups.service';
import { TokenService } from './token.service';

const BCRYPT_COST = 10;
const SHIFT_HOURS = 12;
/** Compared against when an email doesn't exist, so response time doesn't reveal which emails are registered. */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

const toPassengerDTO = (p: Passenger): PassengerDTO => ({
  id: p.id,
  name: p.name,
  email: p.email,
  phone: p.phone,
  isGuest: p.isGuest,
});

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly topUps: TopUpsService,
    private readonly fleet: FleetStateService,
    private readonly activity: ActivityService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async registerPassenger(body: RegisterPassengerBody): Promise<AuthResponse<{ passenger: PassengerDTO }>> {
    const passwordHash = await bcrypt.hash(body.password, BCRYPT_COST);
    let passenger: Passenger;
    try {
      passenger = await this.prisma.passenger.create({
        data: { name: body.name, email: body.email, phone: body.phone ?? null, passwordHash, account: { create: { kind: 'PASSENGER_WALLET' } } },
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict(ErrorCodes.CONFLICT, 'An account with this email already exists. Sign in instead.');
      throw err;
    }
    if (this.config.DEMO_MODE) {
      await this.topUps.grantPromo(passenger.id, naira(1_500), `welcome_${passenger.id}`, 'Welcome credit');
    }
    return { ...this.tokens.issue({ role: 'passenger', sub: passenger.id }), passenger: toPassengerDTO(passenger) };
  }

  async loginPassenger(body: LoginBody): Promise<AuthResponse<{ passenger: PassengerDTO }>> {
    const passenger = await this.prisma.passenger.findUnique({ where: { email: body.email } });
    const ok = await bcrypt.compare(body.password, passenger?.passwordHash ?? DUMMY_HASH);
    if (!passenger || !ok) throw new AppError(ErrorCodes.UNAUTHORIZED, 'Email or password is incorrect.', HttpStatus.UNAUTHORIZED);
    return { ...this.tokens.issue({ role: 'passenger', sub: passenger.id }), passenger: toPassengerDTO(passenger) };
  }

  /** Demo only: a throwaway account with ride credit, so anyone can try the full flow in one tap. */
  async guest(): Promise<AuthResponse<{ passenger: PassengerDTO }>> {
    if (!this.config.DEMO_MODE) throw notFound('Route');
    const id = randomBytes(4).toString('hex');
    const passenger = await this.prisma.passenger.create({
      data: {
        name: `Guest ${id.slice(0, 4).toUpperCase()}`,
        email: `guest-${id}@demo.ridesrus.app`,
        passwordHash: await bcrypt.hash(randomBytes(16).toString('hex'), BCRYPT_COST),
        isGuest: true,
        account: { create: { kind: 'PASSENGER_WALLET' } },
      },
    });
    await this.topUps.grantPromo(passenger.id, naira(2_000), `guest_${passenger.id}`, 'Demo ride credit');
    return { ...this.tokens.issue({ role: 'passenger', sub: passenger.id }, 7 * 24 * 3600), passenger: toPassengerDTO(passenger) };
  }

  async me(passengerId: string): Promise<PassengerDTO> {
    const p = await this.prisma.passenger.findUnique({ where: { id: passengerId } });
    if (!p) throw new AppError(ErrorCodes.UNAUTHORIZED, 'Please sign in again.', HttpStatus.UNAUTHORIZED);
    return toPassengerDTO(p);
  }

  /**
   * Driver sign-in = start of shift. The admin issued a one-time 6-digit key bound
   * to this driver and a specific bus; using it opens a 12-hour shift on that bus
   * and closes any shift the bus or driver still had open.
   */
  async driverLogin(body: DriverLoginBody) {
    const fail = () => new AppError(ErrorCodes.UNAUTHORIZED, 'Driver ID or access key is incorrect, or the key has expired.', HttpStatus.UNAUTHORIZED);
    const driver = await this.prisma.driver.findUnique({ where: { code: body.driverCode } });
    if (!driver) {
      await bcrypt.compare(body.pin, DUMMY_HASH);
      throw fail();
    }
    const keys = await this.prisma.shiftKey.findMany({
      where: { driverId: driver.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    let key: (typeof keys)[number] | undefined;
    for (const k of keys) if (await bcrypt.compare(body.pin, k.pinHash)) key = k;
    if (!key) throw fail();

    const now = new Date();
    const shift = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.shiftKey.updateMany({ where: { id: key!.id, usedAt: null }, data: { usedAt: now } });
      if (claimed.count === 0) throw fail();
      await tx.shift.updateMany({
        where: { endedAt: null, OR: [{ busId: key!.busId }, { driverId: driver.id }] },
        data: { endedAt: now },
      });
      return tx.shift.create({
        data: { driverId: driver.id, busId: key!.busId, expiresAt: new Date(now.getTime() + SHIFT_HOURS * 3600_000) },
        include: { bus: true },
      });
    });

    this.fleet.setShift(shift.busId, shift.id);
    this.activity.record('SHIFT', `${driver.name} (${driver.code}) started a shift on ${shift.bus.code}`, shift.bus.code);
    return {
      ...this.tokens.issue({ role: 'driver', sub: driver.id, shiftId: shift.id, busId: shift.busId }, SHIFT_HOURS * 3600),
      driver: { id: driver.id, code: driver.code, name: driver.name },
      bus: { id: shift.bus.id, code: shift.bus.code, plate: shift.bus.plate },
    };
  }

  async adminLogin(body: LoginBody) {
    const admin = await this.prisma.admin.findUnique({ where: { email: body.email } });
    const ok = await bcrypt.compare(body.password, admin?.passwordHash ?? DUMMY_HASH);
    if (!admin || !ok) throw new AppError(ErrorCodes.UNAUTHORIZED, 'Email or password is incorrect.', HttpStatus.UNAUTHORIZED);
    return { ...this.tokens.issue({ role: 'admin', sub: admin.id }), admin: { id: admin.id, name: admin.name, email: admin.email } };
  }
}
