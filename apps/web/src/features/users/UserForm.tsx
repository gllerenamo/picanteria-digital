import { zodResolver } from '@hookform/resolvers/zod';
import {
  ERROR_MESSAGES,
  createUserRequestSchema,
  editUserFieldsSchema,
  type CreateUserRequest,
  type EditUserFields,
  type ErrorCode,
  type User,
} from '@picanteria/shared';
import { useEffect } from 'react';
import { useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form';
import type { z } from 'zod';
import { ApiError } from '../../lib/api-client';
import { FormActions, FormAlert, RoleSelect, TextField, apiFieldErrors } from './form-fields';

interface FormProps<TOutput> {
  onSubmit: (input: TOutput) => void;
  onCancel: () => void;
  pending: boolean;
  /** Error devuelto por la API al guardar. */
  error: unknown;
}

/**
 * Lleva los errores de la API a los campos del formulario. Devuelve el mensaje general
 * cuando el error no corresponde a ningún campo.
 */
function useApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
  fieldByCode: Partial<Record<ErrorCode, Path<T>>>,
): string | null {
  useEffect(() => {
    if (!(error instanceof ApiError) || error.code === 'NETWORK_ERROR') return;
    const field = fieldByCode[error.code];
    if (field) {
      setError(field, { message: error.message });
      return;
    }
    for (const [name, message] of Object.entries(apiFieldErrors(error))) {
      const match = fields.find((candidate) => candidate === name);
      if (match) setError(match, { message });
    }
  }, [error, setError, fields, fieldByCode]);

  if (!error) return null;
  if (!(error instanceof ApiError)) return ERROR_MESSAGES.INTERNAL_ERROR;
  if (error.code !== 'NETWORK_ERROR' && fieldByCode[error.code]) return null;
  const mapped = Object.keys(apiFieldErrors(error)).some((name) => fields.some((field) => field === name));
  return mapped ? null : error.message;
}

type CreateUserInput = z.input<typeof createUserRequestSchema>;
const CREATE_FIELDS = ['fullName', 'username', 'password', 'role'] as const;
const CREATE_FIELD_BY_CODE: Partial<Record<ErrorCode, Path<CreateUserInput>>> = { USERNAME_TAKEN: 'username' };

export function CreateUserForm({ onSubmit, onCancel, pending, error }: FormProps<CreateUserRequest>) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CreateUserInput, unknown, CreateUserRequest>({
    resolver: zodResolver(createUserRequestSchema),
    defaultValues: { fullName: '', username: '', password: '', role: 'WAITER' },
  });
  const general = useApiErrors(error, setError, CREATE_FIELDS, CREATE_FIELD_BY_CODE);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void handleSubmit((data) => {
          onSubmit(data);
        })(event);
      }}
    >
      <TextField id="user-fullName" label="Nombre completo" error={errors.fullName?.message} {...register('fullName')} />
      <TextField
        id="user-username"
        label="Usuario"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        error={errors.username?.message}
        {...register('username')}
      />
      <TextField
        id="user-password"
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <RoleSelect id="user-role" label="Rol" error={errors.role?.message} {...register('role')} />
      <FormAlert>{general}</FormAlert>
      <FormActions pending={pending} onCancel={onCancel} />
    </form>
  );
}

type EditUserInput = z.input<typeof editUserFieldsSchema>;
const EDIT_FIELDS = ['fullName', 'role'] as const;
const EDIT_FIELD_BY_CODE: Partial<Record<ErrorCode, Path<EditUserInput>>> = { LAST_ADMIN: 'role' };

export function EditUserForm({ user, onSubmit, onCancel, pending, error }: FormProps<EditUserFields> & { user: User }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EditUserInput, unknown, EditUserFields>({
    resolver: zodResolver(editUserFieldsSchema),
    defaultValues: { fullName: user.fullName, role: user.role },
  });
  const general = useApiErrors(error, setError, EDIT_FIELDS, EDIT_FIELD_BY_CODE);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void handleSubmit((data) => {
          onSubmit(data);
        })(event);
      }}
    >
      <p className="text-base text-muted">
        Usuario: <strong className="text-ink">{user.username}</strong>
      </p>
      <TextField id="user-fullName" label="Nombre completo" error={errors.fullName?.message} {...register('fullName')} />
      <RoleSelect id="user-role" label="Rol" error={errors.role?.message} {...register('role')} />
      <FormAlert>{general}</FormAlert>
      <FormActions pending={pending} onCancel={onCancel} />
    </form>
  );
}
