"use client";

import { useTranslations } from "next-intl";

export interface CrmOpportunitiesViewProps {
  isManager: boolean;
  userId: number;
}

/** Pendiente de implementar (CRM comercial). */
export function CrmOpportunitiesView(props: CrmOpportunitiesViewProps) {
  const t = useTranslations("pages.plataforma.comercialOportunidades");
  void props;
  return <h1 className="text-xl font-semibold text-text-base">{t("title")}</h1>;
}
