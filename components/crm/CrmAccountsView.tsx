"use client";

import { useTranslations } from "next-intl";

export interface CrmAccountsViewProps {
  isManager: boolean;
  userId: number;
}

/** Pendiente de implementar (CRM comercial). */
export function CrmAccountsView(props: CrmAccountsViewProps) {
  const t = useTranslations("pages.plataforma.comercialEntidades");
  void props;
  return <h1 className="text-xl font-semibold text-text-base">{t("title")}</h1>;
}
