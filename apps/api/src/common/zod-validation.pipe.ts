import { HttpStatus, Injectable, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { AppException } from './app.exception';

/** Valida el cuerpo contra un esquema Zod compartido; los errores van en español. */
@Injectable()
export class ZodValidationPipe<TSchema extends z.ZodTypeAny> implements PipeTransform<unknown, z.output<TSchema>> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data as z.output<TSchema>;
    const details: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join('.') || '_';
      details[field] ??= issue.message;
    }
    throw new AppException('VALIDATION_ERROR', HttpStatus.BAD_REQUEST, { details });
  }
}
