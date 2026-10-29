import { z } from 'zod';
import { roleSchema } from './auth';

// Reglas de specs/001-base-comun/data-model.md § User.
const fullNameSchema = z
  .string({ required_error: 'Ingresa el nombre completo' })
  .trim()
  .min(2, 'El nombre completo debe tener al menos 2 caracteres')
  .max(100, 'El nombre completo tiene como máximo 100 caracteres');

const usernameSchema = z
  .string({ required_error: 'Ingresa el nombre de usuario' })
  .trim()
  .regex(
    /^[a-zA-Z0-9._-]{3,30}$/,
    'El usuario debe tener de 3 a 30 caracteres: letras sin tildes, números, punto, guion o guion bajo',
  )
  .transform((username) => username.toLowerCase());

const passwordSchema = z
  .string({ required_error: 'Ingresa la contraseña' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña tiene como máximo 128 caracteres');

const userRoleSchema = z.enum(roleSchema.options, {
  errorMap: () => ({ message: 'Elige un rol' }),
});

export const createUserRequestSchema = z
  .object({
    fullName: fullNameSchema,
    username: usernameSchema,
    password: passwordSchema,
    role: userRoleSchema,
  })
  .strict();
export type CreateUserRequest = z.output<typeof createUserRequestSchema>;

/** Campos que el formulario de edición permite cambiar (el usuario no se edita). */
export const editUserFieldsSchema = z.object({ fullName: fullNameSchema, role: userRoleSchema }).strict();
export type EditUserFields = z.output<typeof editUserFieldsSchema>;

export const updateUserRequestSchema = editUserFieldsSchema
  .partial()
  .refine((input) => input.fullName !== undefined || input.role !== undefined, {
    message: 'Indica el nombre completo o el rol a cambiar',
  });
export type UpdateUserRequest = z.output<typeof updateUserRequestSchema>;

export const setPasswordRequestSchema = z.object({ password: passwordSchema }).strict();
export type SetPasswordRequest = z.output<typeof setPasswordRequestSchema>;

export const setStatusRequestSchema = z
  .object({ isActive: z.boolean({ required_error: 'Indica si el usuario queda activo' }) })
  .strict();
export type SetStatusRequest = z.output<typeof setStatusRequestSchema>;

/** Usuario tal como lo devuelve la API: nunca incluye la contraseña (FR-021). */
export const userSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  username: z.string(),
  role: roleSchema,
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type User = z.output<typeof userSchema>;
