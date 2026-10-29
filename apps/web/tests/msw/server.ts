import { setupServer } from 'msw/node';

// Cada prueba registra sus propios manejadores con `server.use(...)`.
export const server = setupServer();
