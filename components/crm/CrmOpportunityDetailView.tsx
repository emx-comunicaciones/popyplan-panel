"use client";

import { useTranslations } from "next-intl";

export interface CrmOpportunityDetailViewProps {
  id: number; isManager: boolean;
  userId: number;
}

/** Pendiente de implementar (CRM comercial). */
export function CrmOpportunityDetailView(props: CrmOpportunityDetailViewProps) {
  const t = useTranslations("pages.plataforma.comercialOportunidadFicha");
  void props;
  return <h1 className="text-xl font-semibold text-text-base">{t("title")}</h1>;
}
