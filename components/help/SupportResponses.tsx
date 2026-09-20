"use client";

/**
 * «Me encargo» de la red de apoyo dentro de un aviso de ayuda
 * (`HelpRequest.support_responses`, `docs/PANEL.md` §14.4).
 *
 * **Hallazgo D-I4 de la auditoría de integración (2026-09-21)**: el
 * backend sirve este array desde la Fase 7 y `lib/api/types.ts
 * ::SupportResponse` ya lo tipaba, pero ni la guardia de la entidad ni
 * la cola de ayuda de plataforma lo pintaban (la app móvil sí). La
 * guardia llamaba a una persona sin saber que su madre o su pareja
 * llevaba veinte minutos con ella — justo la intervención duplicada que
 * la Fase 7 quería evitar.
 *
 * Lo que se pinta es lo único que trae el contrato: el alias público de
 * quien respondió y cuándo (`ReferentDisplay {id, public_name}` +
 * `responded_at`). **Nunca** datos de contacto, y tampoco la relación
 * (`parent`/`friend`/…): esa vive en el vínculo de la red
 * (`PersonSupportRow.relationship`, solo para el referente en la ficha
 * de la persona), no en este aviso — el serializer del backend no la
 * manda aquí a propósito.
 *
 * Con el array vacío se dice **explícitamente** que nadie se ha
 * encargado todavía: un hueco en blanco se lee como «no hay red», que es
 * un dato distinto.
 */
import { useLocale, useTranslations } from "next-intl";

import type { SupportResponse } from "@/lib/api/types";
import { localeForUseLocale } from "@/lib/i18n/locale";

export interface SupportResponsesProps {
  responses: readonly SupportResponse[];
}

export function SupportResponses({ responses }: SupportResponsesProps) {
  const t = useTranslations("entidad.guardia");
  const locale = useLocale();

  if (responses.length === 0) {
    return <p className="text-sm text-text-secondary">{t("supportResponsesEmpty")}</p>;
  }

  return (
    <ul className="flex flex-col">
      {responses.map((response) => (
        <li key={`${response.supporter.id}-${response.responded_at}`} className="text-sm text-success">
          {t("supportResponse", {
            name: response.supporter.public_name,
            when: new Date(response.responded_at).toLocaleString(localeForUseLocale(locale), {
              dateStyle: "short",
              timeStyle: "short",
            }),
          })}
        </li>
      ))}
    </ul>
  );
}
