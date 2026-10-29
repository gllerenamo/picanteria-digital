import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('genera un hash Argon2id que no contiene la contraseña', async () => {
    const hash = await service.hash('clave-segura-123');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('clave-segura-123');
  });

  it('verifica la contraseña correcta y rechaza la incorrecta', async () => {
    const hash = await service.hash('clave-segura-123');
    await expect(service.verify(hash, 'clave-segura-123')).resolves.toBe(true);
    await expect(service.verify(hash, 'otra-clave')).resolves.toBe(false);
  });

  it('devuelve false ante un hash con formato inválido', async () => {
    await expect(service.verify('no-es-un-hash', 'clave')).resolves.toBe(false);
  });

  it('verifica contra el hash ficticio sin lanzar errores', async () => {
    await expect(service.verifyAgainstDummy('cualquier-clave')).resolves.toBeUndefined();
  });
});
