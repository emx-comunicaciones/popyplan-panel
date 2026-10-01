"use client";

import { useTranslations } from "next-intl";

export interface CrmMapViewProps {
  isManager: boolean;
  userId: number;
}

/** Pendiente de implementar (CRM comercial). */
export function CrmMapView(props: CrmMapViewProps) {
  const t = useTranslations("pages.plataforma.comercialMapa");
  void props;
  return <h1 className="text-xl font-semibold text-text-base">{t("title")}</h1>;
}
