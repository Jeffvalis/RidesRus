import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiErrorBody, ErrorCode, ErrorCodes } from '@ridesrus/core';

/** A domain error with a stable machine-readable code the apps can branch on. */
export class AppError extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly issues?: ApiErrorBody['issues'],
  ) {
    super({ statusCode: status, code, message, issues } satisfies ApiErrorBody, status);
  }
}

export const notFound = (what: string) => new AppError(ErrorCodes.NOT_FOUND, `${what} not found`, HttpStatus.NOT_FOUND);
export const conflict = (code: ErrorCode, message: string) => new AppError(code, message, HttpStatus.CONFLICT);

const STATUS_CODES: Record<number, ErrorCode> = {
  400: ErrorCodes.VALIDATION,
  401: ErrorCodes.UNAUTHORIZED,
  403: ErrorCodes.FORBIDDEN,
  404: ErrorCodes.NOT_FOUND,
  409: ErrorCodes.CONFLICT,
};

/** Every error leaves the API in the same `ApiErrorBody` shape. Internals never leak. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body && 'code' in body) {
        res.status(status).json(body);
        return;
      }
      const message =
        typeof body === 'string' ? body : ((body as { message?: string | string[] }).message ?? exception.message);
      res.status(status).json({
        statusCode: status,
        code: STATUS_CODES[status] ?? 'ERROR',
        message: Array.isArray(message) ? message.join(', ') : message,
      });
      return;
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(500).json({ statusCode: 500, code: 'INTERNAL', message: 'Something went wrong on our side.' });
  }
}
