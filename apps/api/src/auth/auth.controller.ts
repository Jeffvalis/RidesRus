import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DriverLoginBody, LoginBody, RegisterPassengerBody } from '@ridesrus/core';
import { ZodPipe } from '../common/zod.pipe';
import { AuthService } from './auth.service';
import { CurrentUser, PassengerPrincipal, Roles } from './principal';

/** Sign-in endpoints get a tight per-IP limit to slow credential stuffing and PIN guessing. */
const AUTH_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('auth/passenger/register')
  @Throttle(AUTH_LIMIT)
  register(@Body(new ZodPipe(RegisterPassengerBody)) body: RegisterPassengerBody) {
    return this.auth.registerPassenger(body);
  }

  @Post('auth/passenger/login')
  @Throttle(AUTH_LIMIT)
  login(@Body(new ZodPipe(LoginBody)) body: LoginBody) {
    return this.auth.loginPassenger(body);
  }

  @Post('auth/guest')
  @Throttle(AUTH_LIMIT)
  guest() {
    return this.auth.guest();
  }

  @Post('auth/driver/login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  driverLogin(@Body(new ZodPipe(DriverLoginBody)) body: DriverLoginBody) {
    return this.auth.driverLogin(body);
  }

  @Post('auth/admin/login')
  @Throttle(AUTH_LIMIT)
  adminLogin(@Body(new ZodPipe(LoginBody)) body: LoginBody) {
    return this.auth.adminLogin(body);
  }

  @Get('me')
  @Roles('passenger')
  me(@CurrentUser() user: PassengerPrincipal) {
    return this.auth.me(user.sub);
  }
}
