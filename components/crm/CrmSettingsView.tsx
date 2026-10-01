"use client";

import { useTranslations } from "next-intl";

export interface CrmSettingsViewProps {
  isManager: boolean;
  userId: number;
}

/** Pendiente de implementar (CRM comercial). */
export function CrmSettingsView(props: CrmSettingsViewProps) {
  const t = useTranslations("pages.plataforma.comercialConfiguracion");
  void props;
  return <h1 className="text-xl font-semibold text-text-base">{t("title")}</h1>;
}
