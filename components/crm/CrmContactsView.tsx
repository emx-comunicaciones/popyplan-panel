"use client";

import { useTranslations } from "next-intl";

export interface CrmContactsViewProps {
  isManager: boolean;
  userId: number;
}

/** Pendiente de implementar (CRM comercial). */
export function CrmContactsView(props: CrmContactsViewProps) {
  const t = useTranslations("pages.plataforma.comercialContactos");
  void props;
  return <h1 className="text-xl font-semibold text-text-base">{t("title")}</h1>;
}
