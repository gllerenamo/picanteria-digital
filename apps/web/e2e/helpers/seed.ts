import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Recrea los usuarios de prueba (uno por rol) en la base de Docker Compose y borra los pedidos
 * que dejaron las pruebas, con lo que sus mesas quedan libres (apps/api/prisma/seed-e2e.ts).
 */
export function seedE2e(): void {
  const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url));
  execSync('npm run db:seed:e2e -w @picanteria/api', { cwd: repoRoot, stdio: 'inherit' });
}
