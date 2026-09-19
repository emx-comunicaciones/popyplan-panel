"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { useExport, type ExportErrorKind, type ExportFormat, type ExportParams } from "@/hooks/useExport";
import { errorKindText } from "@/lib/i18n/errorKindText";

export interface ExportButtonsProps {
  params: Omit<ExportParams, "format">;
}

// `sesion_caducada` no tenía entrada propia en el mapa original (el
// aviso real de sesión caducada lo pinta `SessionExpiredHandler` a nivel
// de app): se conserva el mismo comportamiento, cae al texto genérico.
const EXPORT_ERROR_KEYS: Record<ExportErrorKind, string> = {
  pdf_unavailable: "errors.export.pdfUnavailable",
  forbidden: "errors.export.forbidden",
  sin_territorio: "errors.export.sinTerritorio",
  sesion_caducada: "errors.export.desconocido",
  desconocido: "errors.export.desconocido",
};

/** Botones «Exportar CSV»/«Exportar PDF»: llaman a `useExport().mutate` con el `format` pulsado. */
export function ExportButtons({ params }: ExportButtonsProps) {
  const t = useTranslations();
  const { mutate, isPending, error } = useExport();
  const [lastFormat, setLastFormat] = useState<ExportFormat | null>(null);

  function handleExport(format: ExportFormat) {
    setLastFormat(format);
    mutate({ ...params, format });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => handleExport("csv")} disabled={isPending}>
          {isPending && lastFormat === "csv" ? t("metrics.export.exporting") : t("metrics.export.csv")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => handleExport("pdf")}
          disabled={isPending}
        >
          {isPending && lastFormat === "pdf" ? t("metrics.export.exporting") : t("metrics.export.pdf")}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-error">
          {errorKindText(error, EXPORT_ERROR_KEYS, t, "errors.export.desconocido")}
        </p>
      ) : null}
    </div>
  );
}
