"use client";

import { useTranslations } from "next-intl";

export interface CrmCalendarViewProps {
  isManager: boolean;
  userId: number;
}

/** Pendiente de implementar (CRM comercial). */
export function CrmCalendarView(props: CrmCalendarViewProps) {
  const t = useTranslations("pages.plataforma.comercialCalendario");
  void props;
  return <h1 className="text-xl font-semibold text-text-base">{t("title")}</h1>;
}
