"use client";

/**
 * Configuración del CRM (puntos 28-31, solo dirección comercial y
 * administración): fases del pipeline, listas, etiquetas y umbrales.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

import { CatalogSection } from "./settings/CatalogSection";
import { StagesSection } from "./settings/StagesSection";
import { TagsSection } from "./settings/TagsSection";
import { ThresholdsSection } from "./settings/ThresholdsSection";

export interface CrmSettingsViewProps {
  isManager: boolean;
  userId: number;
}

type Section = "stages" | "catalog" | "tags" | "thresholds";
const SECTIONS: { key: Section; label: string }[] = [
  { key: "stages", label: "crm.settings.sections.stages" },
  { key: "catalog", label: "crm.settings.sections.catalog" },
  { key: "tags", label: "crm.settings.sections.tags" },
  { key: "thresholds", label: "crm.settings.sections.thresholds" },
];

export function CrmSettingsView({ isManager }: CrmSettingsViewProps) {
  const t = useTranslations();
  const [section, setSection] = useState<Section>("stages");

  if (!isManager) {
    return <EmptyState title={t("common.noAccess")} description={t("crm.settings.noAccess")} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold text-text-base">{t("pages.plataforma.comercialConfiguracion.title")}</h1>
      <div role="group" aria-label={t("crm.settings.sectionsLabel")} className="flex flex-wrap gap-1">
        {SECTIONS.map(({ key, label }) => (
          <Button
            key={key}
            type="button"
            variant={section === key ? "primary" : "secondary"}
            aria-pressed={section === key}
            onClick={() => setSection(key)}
          >
            {t(label)}
          </Button>
        ))}
      </div>
      {section === "stages" ? <StagesSection /> : null}
      {section === "catalog" ? <CatalogSection /> : null}
      {section === "tags" ? <TagsSection /> : null}
      {section === "thresholds" ? <ThresholdsSection /> : null}
    </div>
  );
}
