import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Recrea los usuarios de prueba (uno por rol) en la base de Docker Compose.
export default function globalSetup(): void {
  const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
  execSync('npm run db:seed:e2e -w @picanteria/api', { cwd: repoRoot, stdio: 'inherit' });
}
