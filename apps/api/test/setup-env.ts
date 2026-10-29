import { assertTestDatabase } from './test-database';

// Las pruebas de aceptación usan siempre la base de pruebas, nunca la principal.
process.env.DATABASE_URL = assertTestDatabase(process.env.DATABASE_URL_TEST);
process.env.COOKIE_SECURE = 'false';
