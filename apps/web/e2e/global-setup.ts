import { seedE2e } from './helpers/seed';

// Recrea los usuarios de prueba (uno por rol) en la base de Docker Compose.
export default function globalSetup(): void {
  seedE2e();
}
