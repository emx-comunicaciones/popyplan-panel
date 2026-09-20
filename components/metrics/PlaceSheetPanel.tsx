"use client";

/**
 * Ficha de un municipio del territorio (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §3.2), en el panel
 * lateral que pide §4.1. Se monta solo con un `ineCode`: cerrar el panel
 * es desmontarlo, y `usePlaceSheet` con `ineCode: null` ni siquiera pide.
 *
 * `organizations_based_here` es un **recuento**, nunca una lista de
 * nombres (invariante 1: la administración no ve entidades concretas que
 * no financia). `people`/`attendance` pasan por `formatCount`/`formatPct`,
 * así que una cifra suprimida se lee «<5» igual que en la tabla.
 */
import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Dialog } from "@/components/ui/Dialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { StatCard } from "@/components/metrics/StatCard";
import { usePlaceSheet, type PlaceSheetErrorKind } from "@/hooks/usePlaceSheet";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { formatCount, formatPct } from "@/lib/metrics/format";
import { comarcaLabel } from "@/lib/places/placeLabel";
import type { Period } from "@/lib/metrics/period";

const PLACE_SHEET_ERROR_KEYS: Record<PlaceSheetErrorKind, string> = {
  fuera_de_territorio: "errors.placeSheet.fueraDeTerritorio",
  sin_acceso: "errors.placeSheet.sinAcceso",
  sin_territorio: "errors.placeSheet.sinTerritorio",
  desconocido: "errors.placeSheet.desconocido",
};

export interface PlaceSheetPanelProps {
  orgId: number | string;
  ineCode: string;
  period: Period;
  onClose: () => void;
}

export function PlaceSheetPanel({ orgId, ineCode, period, onClose }: PlaceSheetPanelProps) {
  const t = useTranslations();
  const locale = useLocale();
  const titleId = useId();
  const sheet = usePlaceSheet(orgId, ineCode, period);

  const title = sheet.data ? sheet.data.place.name : t("metrics.placeSheet.loadingTitle");

  return (
    <Dialog
      open
      titleId={titleId}
      title={title}
      onClose={onClose}
      placement="side"
      widthClassName="max-w-md"
    >
      {sheet.isError ? (
        <ErrorState
          title={t("metrics.placeSheet.loadError")}
          description={errorKindText(
            sheet.error,
            PLACE_SHEET_ERROR_KEYS,
            t,
            "errors.placeSheet.desconocido",
          )}
        />
      ) : !sheet.data ? (
        <p className="text-sm text-text-secondary">{t("common.loading")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            {t("metrics.placeSheet.location", {
              comarca: comarcaLabel(sheet.data.place, locale) || t("metrics.placeSheet.noComarca"),
              province: sheet.data.place.prov_name,
              ineCode: sheet.data.place.ine_code,
            })}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label={t("metrics.placeSheet.eventsHeld")}
              value={formatCount(sheet.data.events.held, false)}
            />
            <StatCard
              label={t("metrics.placeSheet.eventsUpcoming")}
              value={formatCount(sheet.data.events.upcoming, false)}
            />
            <StatCard
              label={t("metrics.placeSheet.people")}
              value={formatCount(sheet.data.people.value, sheet.data.people.suppressed)}
            />
            <StatCard
              label={t("metrics.placeSheet.attendance")}
              value={formatPct(sheet.data.attendance.rate, sheet.data.attendance.suppressed)}
            />
            <StatCard
              label={t("metrics.placeSheet.communities")}
              value={formatCount(sheet.data.communities.count, false)}
            />
            <StatCard
              label={t("metrics.placeSheet.organizationsBasedHere")}
              value={formatCount(sheet.data.organizations_based_here, false)}
            />
          </div>
          <p className="text-xs text-text-secondary">{t("metrics.placeSheet.noNamesNotice")}</p>
        </div>
      )}
    </Dialog>
  );
}
