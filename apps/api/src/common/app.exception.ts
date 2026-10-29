import { HttpException } from '@nestjs/common';
import { ERROR_MESSAGES, type ApiErrorBody, type ErrorCode } from '@picanteria/shared';

interface AppExceptionOptions {
  /** Reemplaza el mensaje por defecto del código (siempre en español). */
  message?: string;
  details?: Record<string, unknown>;
}

/** Error de la API con código estable y mensaje en español (contracts/rest-api.yaml § Error). */
export class AppException extends HttpException {
  readonly body: ApiErrorBody;

  constructor(code: ErrorCode, status: number, options: AppExceptionOptions = {}) {
    const body: ApiErrorBody = { code, message: options.message ?? ERROR_MESSAGES[code] };
    if (options.details) body.details = options.details;
    super(body, status);
    this.body = body;
  }
}
