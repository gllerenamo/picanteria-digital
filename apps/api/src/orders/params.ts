import { HttpStatus, Injectable, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { AppException } from '../common/app.exception';

const uuidSchema = z.string().uuid();

/** Un ID con formato inválido se trata igual que un pedido inexistente (como en menu y users). */
@Injectable()
export class OrderIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!uuidSchema.safeParse(value).success) {
      throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: 'El pedido no existe' });
    }
    return value;
  }
}

/** Igual que OrderIdPipe, para los ítems del pedido. */
@Injectable()
export class ItemIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!uuidSchema.safeParse(value).success) {
      throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: 'El ítem no existe' });
    }
    return value;
  }
}

/** Una nota vacía se guarda como `null`; `undefined` significa "no cambiar". */
export function normalizeNotes(notes: string | null | undefined): string | null | undefined {
  if (notes === undefined) return undefined;
  return notes === null || notes === '' ? null : notes;
}
