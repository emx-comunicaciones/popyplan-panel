"use client";

import { useTranslations } from "next-intl";

export interface CrmAccountDetailViewProps {
  id: number; isManager: boolean;
  userId: number;
}

/** Pendiente de implementar (CRM comercial). */
export function CrmAccountDetailView(props: CrmAccountDetailViewProps) {
  const t = useTranslations("pages.plataforma.comercialEntidadFicha");
  void props;
  return <h1 className="text-xl font-semibold text-text-base">{t("title")}</h1>;
}
