import { HttpStatus, Injectable, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { AppException } from '../common/app.exception';

const uuidSchema = z.string().uuid();

/** Un ID de pago con formato inválido se trata igual que un pago inexistente. */
@Injectable()
export class PaymentIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!uuidSchema.safeParse(value).success) {
      throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND, { message: 'El pago no existe' });
    }
    return value;
  }
}
