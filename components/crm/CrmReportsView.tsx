"use client";

import { useTranslations } from "next-intl";

export interface CrmReportsViewProps {
  isManager: boolean;
  userId: number;
}

/** Pendiente de implementar (CRM comercial). */
export function CrmReportsView(props: CrmReportsViewProps) {
  const t = useTranslations("pages.plataforma.comercialInformes");
  void props;
  return <h1 className="text-xl font-semibold text-text-base">{t("title")}</h1>;
}
