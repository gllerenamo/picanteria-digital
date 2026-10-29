import { zodResolver } from '@hookform/resolvers/zod';
import { ERROR_MESSAGES, setPasswordRequestSchema, type SetPasswordRequest, type User } from '@picanteria/shared';
import { useForm } from 'react-hook-form';
import { Modal } from '../../components/Modal';
import { ApiError } from '../../lib/api-client';
import { FormActions, FormAlert, TextField, apiFieldErrors } from './form-fields';

interface PasswordDialogProps {
  user: User;
  onSubmit: (password: string) => void;
  onCancel: () => void;
  pending: boolean;
  error: unknown;
}

/** El administrador asigna una contraseña nueva (AC-3.5); la anterior deja de servir. */
export function PasswordDialog({ user, onSubmit, onCancel, pending, error }: PasswordDialogProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetPasswordRequest>({
    resolver: zodResolver(setPasswordRequestSchema),
    defaultValues: { password: '' },
  });
  const apiError = error instanceof ApiError ? error : null;
  const fieldError = errors.password?.message ?? apiFieldErrors(error).password;
  const general = error && !fieldError ? (apiError?.message ?? ERROR_MESSAGES.INTERNAL_ERROR) : null;

  return (
    <Modal title="Asignar contraseña nueva" onClose={onCancel}>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          void handleSubmit(({ password }) => {
            onSubmit(password);
          })(event);
        }}
      >
        <p className="text-base text-muted">
          Para <strong className="text-ink">{user.fullName}</strong> ({user.username}). Mínimo 8 caracteres.
        </p>
        <TextField
          id="new-password"
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          error={fieldError}
          {...register('password')}
        />
        <FormAlert>{general}</FormAlert>
        <FormActions pending={pending} onCancel={onCancel} />
      </form>
    </Modal>
  );
}
