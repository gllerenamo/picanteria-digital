import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { assertTestDatabase } from './test-database';

// Aplica las migraciones pendientes a la base de pruebas (no borra datos; cada prueba la vacía).
export default function globalSetup(): void {
  const testUrl = assertTestDatabase(process.env.DATABASE_URL_TEST);
  execSync('npx prisma migrate deploy', {
    cwd: join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'inherit',
  });
}
