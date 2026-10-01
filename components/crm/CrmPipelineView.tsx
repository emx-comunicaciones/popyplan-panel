"use client";

import { useTranslations } from "next-intl";

export interface CrmPipelineViewProps {
  isManager: boolean;
  userId: number;
}

/** Pendiente de implementar (CRM comercial). */
export function CrmPipelineView(props: CrmPipelineViewProps) {
  const t = useTranslations("pages.plataforma.comercialPipeline");
  void props;
  return <h1 className="text-xl font-semibold text-text-base">{t("title")}</h1>;
}
