import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { SurveyResultsView } from "@/components/entidad/SurveyResultsView";
import { EmptyState } from "@/components/ui/EmptyState";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { entidadMenuFor } from "@/lib/auth/entidadMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.entidad.encuestaResultados");
  return { title: t("title") };
}

export default async function EntidadSurveyResultsPage({
  params,
}: {
  params: Promise<{ slug: string; surveyId: string }>;
}) {
  const { slug, surveyId } = await params;
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  const membership = session.me.org_memberships.find(
    (m) => m.organization_slug === slug && isEntidadPanelRole(m.role),
  );
  if (!membership) {
    redirect("/");
  }

  const t = await getTranslations();

  if (!entidadMenuFor(membership.role).includes("encuestas")) {
    return (
      <EmptyState title={t("common.noAccess")} description={t("entidad.encuestas.noAccessDescription")} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">{t("entidad.encuestaResultados.heading")}</h1>
      <SurveyResultsView orgId={membership.organization_id} surveyId={surveyId} />
    </div>
  );
}
