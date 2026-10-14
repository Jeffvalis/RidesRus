import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCodes } from '@ridesrus/core';
import { AppError } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { Role, ROLES_KEY } from './principal';
import { TokenService } from './token.service';

/**
 * Global guard. Every route is public unless decorated with @Roles(...).
 * Driver tokens are additionally bound to a live shift, so ending a shift
 * (or an admin ending it) revokes the tablet's access immediately.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    const principal = this.tokens.verify(header?.startsWith('Bearer ') ? header.slice(7) : null);
    if (!principal) throw new AppError(ErrorCodes.UNAUTHORIZED, 'Please sign in again.', HttpStatus.UNAUTHORIZED);
    if (!roles.includes(principal.role)) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'You do not have access to this.', HttpStatus.FORBIDDEN);
    }
    if (principal.role === 'driver') {
      const shift = await this.prisma.shift.findUnique({ where: { id: principal.shiftId } });
      if (!shift || shift.endedAt || shift.expiresAt < new Date()) {
        throw new AppError(ErrorCodes.UNAUTHORIZED, 'Your shift has ended.', HttpStatus.UNAUTHORIZED);
      }
    }
    req.principal = principal;
    return true;
  }
}
