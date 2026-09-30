"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import type { MetricsResponse } from "@/lib/api/types";
import { formatCount, formatMinutes } from "@/lib/metrics/format";
import { StatCard } from "./StatCard";

/**
 * «Servicios de la guardia» (2026-10-01): los avisos de «hoy lo llevo
 * mal» del periodo y qué se hizo con ellos (`metrics.help`, backend
 * `panel/services/metrics.py::_help_section`). Mismo bloque en la
 * entidad, el paraguas, el territorio y la plataforma. Por debajo del
 * umbral el backend suprime la sección entera y aquí sale «<5» en
 * todas las cifras. Sin la sección (un backend anterior), no pinta nada.
 */
export function HelpStats({ help }: { help: MetricsResponse["help"] | undefined }) {
  const t = useTranslations("metrics.help");
  const headingId = useId();
  if (!help) return null;
  const s = help.suppressed;
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-1 text-lg font-semibold text-text-base">
        {t("heading")}
      </h2>
      <p className="mb-2 text-sm text-text-secondary">{t("description")}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("requests")} value={formatCount(help.requests, s)} />
        <StatCard label={t("attended")} value={formatCount(help.attended, s)} />
        <StatCard label={t("pending")} value={formatCount(help.pending, s)} />
        <StatCard label={t("medianResponse")} value={formatMinutes(help.median_response_minutes, s)} />
        <StatCard label={t("contacted")} value={formatCount(help.contacted, s)} />
        <StatCard label={t("referentNotified")} value={formatCount(help.referent_notified, s)} />
        <StatCard label={t("networkResponded")} value={formatCount(help.network_responded, s)} />
        <StatCard label={t("people")} value={formatCount(help.people, s)} />
      </div>
    </section>
  );
}
