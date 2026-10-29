import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Hash de contraseñas con Argon2id (research.md §6). */
@Injectable()
export class PasswordService {
  // Hash ficticio para igualar el tiempo de respuesta cuando el usuario no existe.
  private readonly dummyHash = argon2.hash('contraseña-ficticia-para-igualar-tiempos', { type: argon2.argon2id });

  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /** Gasta el mismo tiempo que una verificación real, sin revelar si el usuario existe. */
  async verifyAgainstDummy(password: string): Promise<void> {
    await this.verify(await this.dummyHash, password);
  }
}
