import { z } from 'zod';
import { ROLES } from '../roles';

export const roleSchema = z.enum(ROLES);

export const loginRequestSchema = z
  .object({
    username: z
      .string({ required_error: 'Ingresa tu usuario' })
      .trim()
      .min(1, 'Ingresa tu usuario')
      .max(30, 'El usuario tiene como máximo 30 caracteres'),
    password: z
      .string({ required_error: 'Ingresa tu contraseña' })
      .min(1, 'Ingresa tu contraseña')
      .max(128, 'La contraseña tiene como máximo 128 caracteres'),
  })
  .strict();
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const currentUserSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  username: z.string(),
  role: roleSchema,
  homePath: z.string(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;
