// Las pruebas de aceptación usan siempre la base de pruebas, nunca la principal.
const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) throw new Error('Falta DATABASE_URL_TEST para las pruebas de aceptación');
process.env.DATABASE_URL = testUrl;
process.env.COOKIE_SECURE = 'false';
