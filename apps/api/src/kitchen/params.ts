import { HttpStatus, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { AppException } from '../common/app.exception';

const uuidSchema = z.string().uuid();

/** Un ID con formato inválido se trata igual que uno inexistente, con el mensaje indicado. */
export class UuidParamPipe implements PipeTransform<string, string> {
  constructor(private readonly notFoundMessage: string) {}

  transform(value: string): string {
    if (!uuidSchema.safeParse(value).success) {
      throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: this.notFoundMessage });
    }
    return value;
  }
}

export const ITEM_NOT_FOUND = 'El plato no existe';
export const VOID_NOT_FOUND = 'La anulación no existe';
export const NOTICE_NOT_FOUND = 'El aviso no existe';
