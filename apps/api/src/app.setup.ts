import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/http-exception.filter';

/** Configuración común de la aplicación, compartida por main.ts y las pruebas. */
export function configureApp(app: NestExpressApplication): void {
  // Detrás de nginx: necesario para que las cookies Secure funcionen con HTTPS.
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
}
