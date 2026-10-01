"use client";

import { useTranslations } from "next-intl";

export interface CrmDocumentsViewProps {
  isManager: boolean;
  userId: number;
}

/** Pendiente de implementar (CRM comercial). */
export function CrmDocumentsView(props: CrmDocumentsViewProps) {
  const t = useTranslations("pages.plataforma.comercialDocumentos");
  void props;
  return <h1 className="text-xl font-semibold text-text-base">{t("title")}</h1>;
}
