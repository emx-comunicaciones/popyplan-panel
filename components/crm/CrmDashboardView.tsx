"use client";

import { useTranslations } from "next-intl";

export interface CrmDashboardViewProps {
  isManager: boolean;
  userId: number;
}

/** Pendiente de implementar (CRM comercial). */
export function CrmDashboardView(props: CrmDashboardViewProps) {
  const t = useTranslations("pages.plataforma.comercial");
  void props;
  return <h1 className="text-xl font-semibold text-text-base">{t("title")}</h1>;
}
