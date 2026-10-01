"use client";

import { useTranslations } from "next-intl";

export interface CrmAttentionViewProps {
  isManager: boolean;
  userId: number;
}

/** Pendiente de implementar (CRM comercial). */
export function CrmAttentionView(props: CrmAttentionViewProps) {
  const t = useTranslations("pages.plataforma.comercialAtencion");
  void props;
  return <h1 className="text-xl font-semibold text-text-base">{t("title")}</h1>;
}
