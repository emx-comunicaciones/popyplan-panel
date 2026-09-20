"use client";

/**
 * «Ayuda» de plataforma: avisos de «hoy lo llevo mal» pendientes de
 * todas las entidades a la vez (`usePlatformPendingHelpRequests`, ruta
 * agregada del backend desde la tarea P7, `docs/PANEL.md` §10.1).
 */
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SupportResponses } from "@/components/help/SupportResponses";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  useAcknowledgeHelpRequestGlobal,
  type AcknowledgeHelpRequestGlobalErrorKind,
} from "@/hooks/useAcknowledgeHelpRequestGlobal";
import {
  usePlatformPendingHelpRequests,
  type PlatformHelpRequestsErrorKind,
} from "@/hooks/usePlatformPendingHelpRequests";
import type { HelpRequestRow } from "@/lib/api/types";
import { NO_PHONE_NOTICE_KEY } from "@/lib/help/noPhoneNotice";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { localeForUseLocale } from "@/lib/i18n/locale";

function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(localeForUseLocale(locale), { dateStyle: "short", timeStyle: "short" });
}

// Mismo texto que `GuardiaPanel.tsx` (`useAcknowledgeHelpRequest`,
// `errors.acknowledgeHelpRequest.*`): los dos hooks llaman al mismo
// endpoint y devuelven los mismos dos mensajes, solo cambia el ámbito
// (una entidad / todas). Se reutiliza la clave en vez de duplicarla.
const ACKNOWLEDGE_ERROR_KEYS: Record<AcknowledgeHelpRequestGlobalErrorKind, string> = {
  sin_permiso: "errors.acknowledgeHelpRequest.sinPermiso",
  desconocido: "errors.acknowledgeHelpRequest.desconocido",
};

const HELP_REQUESTS_ERROR_KEYS: Record<PlatformHelpRequestsErrorKind, string> = {
  sin_acceso: "plataforma.ayuda.sinAcceso",
  desconocido: "plataforma.ayuda.desconocido",
};

/**
 * Igual que `GuardiaPanel::HelpRequestCard` en cuanto a `is_member`/
 * `referent`, pero sin enlace a la ficha: la plataforma no tiene una
 * ruta de ficha de persona propia, solo la de la entidad
 * (`/entidad/{slug}/personas/{userId}`) y aquí no se conoce el slug de
 * cada fila sin una petición aparte por entidad — el badge «No pertenece
 * a la entidad» sigue siendo útil sin el enlace.
 */
function HelpRequestCard({ request }: { request: HelpRequestRow }) {
  const t = useTranslations();
  const locale = useLocale();
  const acknowledge = useAcknowledgeHelpRequestGlobal();
  const { is_member: isMember, public_name: publicName, referent } = request.user_display;

  return (
    <li>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-text-base">{publicName}</p>
              {isMember ? null : <Badge tone="info">{t("entidad.guardia.notMember")}</Badge>}
            </div>
            {referent ? (
              <p className="text-sm text-text-secondary">
                {t("entidad.guardia.referent", { name: referent.public_name })}
              </p>
            ) : null}
            <p className="text-sm text-text-secondary">
              {request.organization_display ? request.organization_display.name : t("plataforma.ayuda.noOrganization")}
              {request.community_display ? ` · ${request.community_display.name}` : ""}
            </p>
            <p className="text-xs text-text-secondary">{formatDateTime(request.created_at, locale)}</p>
            {/* Mismo D-I4 que en la guardia de la entidad: la cola global
                tampoco enseñaba que la red ya se estaba encargando. */}
            <SupportResponses responses={request.support_responses} />
          </div>
          {request.acknowledged_at ? (
            <Badge tone="success">{t("entidad.guardia.acknowledged")}</Badge>
          ) : (
            <Button
              type="button"
              disabled={acknowledge.isPending}
              onClick={() => acknowledge.mutate(request.id)}
            >
              {t("entidad.guardia.acknowledgeAction")}
            </Button>
          )}
        </div>
        {acknowledge.isError ? (
          <p role="alert" className="mt-2 text-sm text-error">
            {errorKindText(acknowledge.error, ACKNOWLEDGE_ERROR_KEYS, t, "errors.acknowledgeHelpRequest.desconocido")}
          </p>
        ) : null}
      </Card>
    </li>
  );
}

function AvisosBody() {
  const t = useTranslations();
  const requests = usePlatformPendingHelpRequests();

  if (requests.isError) {
    return (
      <ErrorState
        title={t("plataforma.ayuda.loadError")}
        description={errorKindText(requests.error, HELP_REQUESTS_ERROR_KEYS, t, "plataforma.ayuda.desconocido")}
      />
    );
  }
  if (!requests.data) {
    return <p className="text-sm text-text-secondary">{t("plataforma.ayuda.loading")}</p>;
  }
  if (requests.data.length === 0) {
    return (
      <EmptyState
        title={t("plataforma.ayuda.emptyTitle")}
        description={t("plataforma.ayuda.emptyDescription")}
      />
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {requests.data.map((request) => (
        <HelpRequestCard key={request.id} request={request} />
      ))}
    </ul>
  );
}

export function AyudaPendienteList() {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-3">
      <AvisosBody />
      {/*
        Mismo recordatorio que la guardia de la entidad
        (`GuardiaPanel.tsx`), de la misma clave y en todos los estados
        (cargando, error, sin avisos y con avisos): quien atiende desde
        plataforma tampoco tiene un teléfono al que llamar, y saberlo no
        depende de que la consulta haya ido bien.
      */}
      <p className="text-sm text-text-secondary">{t(NO_PHONE_NOTICE_KEY)}</p>
    </div>
  );
}
