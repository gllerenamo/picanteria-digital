/**
 * Las pruebas vacían tablas: solo se permiten contra una base cuyo nombre termine en "_test",
 * para no borrar nunca la base principal por un error de configuración.
 */
export function assertTestDatabase(url: string | undefined): string {
  if (!url) throw new Error('Falta DATABASE_URL_TEST para las pruebas de aceptación');
  const databaseName = new URL(url).pathname.replace(/^\//, '');
  if (!databaseName.endsWith('_test')) {
    throw new Error(`DATABASE_URL_TEST debe apuntar a una base terminada en "_test" (recibido: "${databaseName}")`);
  }
  return url;
}
