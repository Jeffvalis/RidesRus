import { HttpStatus, PipeTransform } from '@nestjs/common';
import { ErrorCodes } from '@ridesrus/core';
import type { ZodType } from 'zod';
import { AppError } from './errors';

/** Validates a request body against the same zod contract the apps use for their forms. */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const issues = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw new AppError(ErrorCodes.VALIDATION, issues[0]?.message ?? 'Invalid request', HttpStatus.BAD_REQUEST, issues);
  }
}
