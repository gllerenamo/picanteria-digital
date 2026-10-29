import { execSync } from 'node:child_process';
import { join } from 'node:path';

// Reinicia la base de pruebas y le aplica todas las migraciones antes de las suites.
export default function globalSetup(): void {
  const testUrl = process.env.DATABASE_URL_TEST;
  if (!testUrl) throw new Error('Falta DATABASE_URL_TEST para las pruebas de aceptación');
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    cwd: join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'inherit',
  });
}
