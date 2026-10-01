"use client";

import { useTranslations } from "next-intl";

export interface CrmActivitiesViewProps {
  isManager: boolean;
  userId: number;
}

/** Pendiente de implementar (CRM comercial). */
export function CrmActivitiesView(props: CrmActivitiesViewProps) {
  const t = useTranslations("pages.plataforma.comercialActividades");
  void props;
  return <h1 className="text-xl font-semibold text-text-base">{t("title")}</h1>;
}
