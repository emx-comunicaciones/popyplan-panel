"use client";

import { useTranslations } from "next-intl";
import { ORG_ROLE_LABEL_KEYS, enumLabel } from "@/lib/i18n/enumLabels";

/**
 * «¿Qué puede hacer cada rol?», desplegable junto al selector de rol del
 * equipo (Configuración de la entidad y ficha de entidad de plataforma).
 * El texto resume la matriz real: `entities/permissions.py` del backend
 * y la visibilidad del menú por rol (`lib/auth/entidadMenu.ts`). Si
 * cambia una de las dos, hay que revisar `entidad.rolesHelp.*`.
 */
const ROLES = ["titular", "moderador", "dinamizador", "analista", "referente", "voluntario"] as const;

const DESCRIPTION_KEYS: Record<(typeof ROLES)[number], string> = {
  titular: "entidad.rolesHelp.titular",
  moderador: "entidad.rolesHelp.moderador",
  dinamizador: "entidad.rolesHelp.dinamizador",
  analista: "entidad.rolesHelp.analista",
  referente: "entidad.rolesHelp.referente",
  voluntario: "entidad.rolesHelp.voluntario",
};

export function RolesHelp() {
  const t = useTranslations();
  return (
    <details className="mb-4 rounded-md border border-border bg-primary-100/50 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-primary-700">{t("entidad.rolesHelp.summary")}</summary>
      <dl className="mt-2 space-y-2">
        {ROLES.map((role) => (
          <div key={role}>
            <dt className="font-semibold text-text-base">{enumLabel(ORG_ROLE_LABEL_KEYS, role, t)}</dt>
            <dd className="text-text-secondary">{t(DESCRIPTION_KEYS[role])}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-text-secondary">{t("entidad.rolesHelp.onCall")}</p>
    </details>
  );
}
