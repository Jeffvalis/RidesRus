import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export type Role = 'passenger' | 'driver' | 'admin';

export type PassengerPrincipal = { role: 'passenger'; sub: string };
export type DriverPrincipal = { role: 'driver'; sub: string; shiftId: string; busId: string };
export type AdminPrincipal = { role: 'admin'; sub: string };
export type Principal = PassengerPrincipal | DriverPrincipal | AdminPrincipal;

export const ROLES_KEY = 'roles';
/** Restrict a controller or handler to the given roles. Routes without @Roles are public. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Principal => ctx.switchToHttp().getRequest().principal,
);
