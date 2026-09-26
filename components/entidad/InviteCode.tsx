"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { useCommunityInviteCode, type CommunityInviteCodeErrorKind } from "@/hooks/useCommunityInviteCode";
import type { CommunityVisibility } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

const INVITE_CODE_ERROR_KEYS: Record<CommunityInviteCodeErrorKind, string> = {
  sin_permiso: "errors.communityInviteCode.sinPermiso",
  no_privada: "errors.communityInviteCode.noPrivada",
  desconocido: "errors.communityInviteCode.desconocido",
};

/**
 * Visibilidades en las que se entra con código y que, por eso, tienen
 * código de invitación que repartir: `private` y `private_listed`
 * (`communities/unified_viewset.py::VISIBILIDADES_CON_CODIGO`, backend
 * 75a8b85 — antes solo `private`, y una `private_listed` quedaba como
 * callejón sin salida).
 */
export function hasInviteCode(visibility: CommunityVisibility): boolean {
  return visibility === "private" || visibility === "private_listed";
}

/**
 * Código de invitación de una comunidad que se entra con código (hallazgo
 * B-I8 de la auditoría de integración): el panel ofrecía crear
 * comunidades privadas pero no enseñaba el código en ninguna parte, así
 * que la comunidad nacía sin forma de que entrara nadie. Solo se monta con
 * `hasInviteCode(visibility)` y `canManage` — las dos condiciones que el
 * backend exige (`invite_code` responde 400 y 403 respectivamente). Lo
 * comparten Comunidades (`ComunidadesPanel.tsx`) y Familias
 * (`FamiliasPanel.tsx`, donde el espacio de familias nace `private`).
 */
export function InviteCode({ communityId }: { communityId: string }) {
  const t = useTranslations("entidad.comunidades");
  const tAll = useTranslations();
  const inviteCode = useCommunityInviteCode(communityId);
  const [copied, setCopied] = useState<boolean | null>(null);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles (o sin API en ese navegador): el
      // código sigue visible y seleccionable, solo se avisa.
      setCopied(false);
    }
  }

  return (
    <div className="mb-3 rounded-md border border-border bg-border-light p-3">
      <h3 className="text-sm font-semibold text-text-base">{t("inviteCodeTitle")}</h3>
      <p className="mt-1 text-xs text-text-secondary">{t("inviteCodeHint")}</p>
      {inviteCode.isError ? (
        <p role="alert" className="mt-2 text-sm text-error">
          {errorKindText(
            inviteCode.error,
            INVITE_CODE_ERROR_KEYS,
            tAll,
            "errors.communityInviteCode.desconocido",
          )}
        </p>
      ) : !inviteCode.data ? (
        <p className="mt-2 text-sm text-text-secondary">{t("inviteCodeLoading")}</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="rounded border border-border bg-white px-2 py-1 text-sm text-text-base">
            {inviteCode.data}
          </code>
          <Button type="button" variant="secondary" onClick={() => copy(inviteCode.data)}>
            {t("inviteCodeCopy")}
          </Button>
          {copied === true ? (
            <span role="status" className="text-sm text-success">
              {t("inviteCodeCopied")}
            </span>
          ) : null}
          {copied === false ? (
            <span role="alert" className="text-sm text-error">
              {t("inviteCodeCopyError")}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
