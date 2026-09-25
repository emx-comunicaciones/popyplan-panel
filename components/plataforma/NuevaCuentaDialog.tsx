"use client";

/**
 * «Nueva cuenta» del admin de plataforma (bloque 1, 2026-09-26):
 * `POST /api/auth/admin-register/` (`AdminUserCreateSerializer`). La
 * cuenta nace activa y verificada; sin contraseña, el backend genera una
 * aleatoria y hay que enviar después el restablecimiento desde la ficha.
 * Al crearla se abre su ficha. `is_staff`/`is_superuser` no se ofrecen
 * (ver `lib/api/types.ts::AdminRegisterRequest`).
 */
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useCreatePlatformUser, type PlatformUserMutationErrorKind } from "@/hooks/usePlatformUser";
import { errorKindText } from "@/lib/i18n/errorKindText";

import { accountHref } from "./UsuariosTable";

export const PLATFORM_USER_MUTATION_ERROR_KEYS: Record<PlatformUserMutationErrorKind, string> = {
  invalido: "errors.platformUserMutation.invalido",
  sin_permiso: "errors.platformUserMutation.sinPermiso",
  no_encontrado: "errors.platformUserMutation.noEncontrado",
  demasiados_intentos: "errors.platformUserMutation.demasiadosIntentos",
  desconocido: "errors.platformUserMutation.desconocido",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export interface NuevaCuentaDialogProps {
  onClose: () => void;
}

export function NuevaCuentaDialog({ onClose }: NuevaCuentaDialogProps) {
  const t = useTranslations();
  const router = useRouter();
  const create = useCreatePlatformUser();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const canSubmit =
    EMAIL_PATTERN.test(email.trim()) && username.trim().length > 0 && !passwordTooShort;

  function handleClose() {
    create.reset();
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    create.mutate(
      {
        email: email.trim(),
        username: username.trim(),
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        password: password || undefined,
      },
      { onSuccess: (account) => router.push(accountHref(account)) },
    );
  }

  const field = "w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700";
  const label = "mb-1 block text-sm font-medium text-text-form";

  return (
    <Dialog
      open
      titleId="nueva-cuenta-title"
      title={t("plataforma.usuarios.newAccount")}
      onClose={handleClose}
      pending={create.isPending}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="nueva-cuenta-email" className={label}>
            {t("plataforma.usuarios.emailHeader")}
          </label>
          <input
            id="nueva-cuenta-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="nueva-cuenta-username" className={label}>
            {t("plataforma.usuarios.usernameHeader")}
          </label>
          <input
            id="nueva-cuenta-username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className={field}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-40 flex-1">
            <label htmlFor="nueva-cuenta-first-name" className={label}>
              {t("plataforma.usuarios.firstNameLabel")}
            </label>
            <input
              id="nueva-cuenta-first-name"
              type="text"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className={field}
            />
          </div>
          <div className="min-w-40 flex-1">
            <label htmlFor="nueva-cuenta-last-name" className={label}>
              {t("plataforma.usuarios.lastNameLabel")}
            </label>
            <input
              id="nueva-cuenta-last-name"
              type="text"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className={field}
            />
          </div>
        </div>
        <div>
          <label htmlFor="nueva-cuenta-password" className={label}>
            {t("plataforma.usuarios.passwordLabel")}
          </label>
          <input
            id="nueva-cuenta-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="nueva-cuenta-password-hint"
            className={field}
          />
          <p id="nueva-cuenta-password-hint" className="mt-1 text-xs text-text-secondary">
            {passwordTooShort ? t("plataforma.usuarios.passwordTooShort") : t("plataforma.usuarios.passwordHint")}
          </p>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={!canSubmit || create.isPending}>
            {t("plataforma.usuarios.createAction")}
          </Button>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={create.isPending}>
            {t("common.cancel")}
          </Button>
        </div>

        {create.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(create.error, PLATFORM_USER_MUTATION_ERROR_KEYS, t, "errors.platformUserMutation.desconocido")}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
