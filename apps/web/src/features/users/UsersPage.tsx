import { ERROR_MESSAGES, ROLE_LABELS, type User } from '@picanteria/shared';
import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { ApiError } from '../../lib/api-client';
import { useCreateUser, useSetPassword, useSetStatus, useUpdateUser, useUsers } from './api';
import { ConfirmDialog } from './ConfirmDialog';
import { FormAlert } from './form-fields';
import { PasswordDialog } from './PasswordDialog';
import { CreateUserForm, EditUserForm } from './UserForm';

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; user: User }
  | { kind: 'password'; user: User }
  | { kind: 'deactivate'; user: User };

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError ? error.message : ERROR_MESSAGES.INTERNAL_ERROR;
}

const actionClass = 'touch-target rounded-lg border border-line px-3 text-base font-medium active:bg-line';

/** Gestión de usuarios del administrador (US3). */
export function UsersPage() {
  const { data: users, isPending, error } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const setPassword = useSetPassword();
  const setStatus = useSetStatus();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const open = (next: Dialog) => {
    createUser.reset();
    updateUser.reset();
    setPassword.reset();
    setStatus.reset();
    setNotice(null);
    setDialog(next);
  };
  const close = () => {
    setDialog(null);
  };
  const done = (message: string) => {
    setDialog(null);
    setNotice(message);
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Gestión de usuarios</h1>
        <button
          type="button"
          onClick={() => {
            open({ kind: 'create' });
          }}
          className="touch-target rounded-lg bg-brand px-5 text-lg font-semibold text-white active:bg-brand-dark"
        >
          Nuevo usuario
        </button>
      </div>

      {notice && (
        <p className="rounded-lg bg-green-50 p-3 text-base text-success" role="status">
          {notice}
        </p>
      )}
      {!dialog && <FormAlert>{errorMessage(setStatus.error)}</FormAlert>}

      {isPending && <p className="text-lg text-muted">Cargando usuarios…</p>}
      {error && <FormAlert>{errorMessage(error)}</FormAlert>}

      {users && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full text-left text-base">
            <thead className="border-b border-line bg-surface text-sm text-muted uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Nombre completo</th>
                <th scope="col" className="px-4 py-3 font-semibold">Usuario</th>
                <th scope="col" className="px-4 py-3 font-semibold">Rol</th>
                <th scope="col" className="px-4 py-3 font-semibold">Estado</th>
                <th scope="col" className="px-4 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3 font-medium">{user.fullName}</td>
                  <td className="px-4 py-3">{user.username}</td>
                  <td className="px-4 py-3">{ROLE_LABELS[user.role]}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-semibold ${
                        user.isActive ? 'bg-green-50 text-success' : 'bg-line text-muted'
                      }`}
                    >
                      {user.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={actionClass}
                        onClick={() => {
                          open({ kind: 'edit', user });
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={actionClass}
                        onClick={() => {
                          open({ kind: 'password', user });
                        }}
                      >
                        Cambiar contraseña
                      </button>
                      {user.isActive ? (
                        <button
                          type="button"
                          className={`${actionClass} text-danger`}
                          onClick={() => {
                            open({ kind: 'deactivate', user });
                          }}
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={actionClass}
                          disabled={setStatus.isPending}
                          onClick={() => {
                            setNotice(null);
                            setStatus.mutate(
                              { id: user.id, isActive: true },
                              {
                                onSuccess: () => {
                                  setNotice(`${user.fullName} fue reactivado.`);
                                },
                              },
                            );
                          }}
                        >
                          Reactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.kind === 'create' && (
        <Modal title="Nuevo usuario" onClose={close}>
          <CreateUserForm
            pending={createUser.isPending}
            error={createUser.error}
            onCancel={close}
            onSubmit={(input) => {
              createUser.mutate(input, {
                onSuccess: (user) => {
                  done(`${user.fullName} fue registrado.`);
                },
              });
            }}
          />
        </Modal>
      )}

      {dialog?.kind === 'edit' && (
        <Modal title="Editar usuario" onClose={close}>
          <EditUserForm
            user={dialog.user}
            pending={updateUser.isPending}
            error={updateUser.error}
            onCancel={close}
            onSubmit={(input) => {
              updateUser.mutate(
                { id: dialog.user.id, input },
                {
                  onSuccess: (user) => {
                    done(`Se guardaron los cambios de ${user.fullName}.`);
                  },
                },
              );
            }}
          />
        </Modal>
      )}

      {dialog?.kind === 'password' && (
        <PasswordDialog
          user={dialog.user}
          pending={setPassword.isPending}
          error={setPassword.error}
          onCancel={close}
          onSubmit={(password) => {
            setPassword.mutate(
              { id: dialog.user.id, password },
              {
                onSuccess: () => {
                  done(`Se asignó una contraseña nueva a ${dialog.user.fullName}.`);
                },
              },
            );
          }}
        />
      )}

      {dialog?.kind === 'deactivate' && (
        <ConfirmDialog
          title="Desactivar usuario"
          message={`¿Desactivar a ${dialog.user.fullName}? No podrá ingresar al sistema.`}
          pending={setStatus.isPending}
          error={errorMessage(setStatus.error)}
          onCancel={close}
          onConfirm={() => {
            setStatus.mutate(
              { id: dialog.user.id, isActive: false },
              {
                onSuccess: () => {
                  done(`${dialog.user.fullName} fue desactivado.`);
                },
              },
            );
          }}
        />
      )}
    </section>
  );
}
