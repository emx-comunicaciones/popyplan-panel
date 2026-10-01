"use client";

import { useTranslations } from "next-intl";

export interface CrmTasksViewProps {
  isManager: boolean;
  userId: number;
}

/** Pendiente de implementar (CRM comercial). */
export function CrmTasksView(props: CrmTasksViewProps) {
  const t = useTranslations("pages.plataforma.comercialTareas");
  void props;
  return <h1 className="text-xl font-semibold text-text-base">{t("title")}</h1>;
}
