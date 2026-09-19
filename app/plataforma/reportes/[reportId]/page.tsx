import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ReporteDetail } from "@/components/entidad/ReporteDetail";
import { EmptyState } from "@/components/ui/EmptyState";
import { isPlatformRole, plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.plataforma.reporteDetalle");
  return { title: t("title") };
}

export default async function PlataformaReporteDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!isPlatformRole(session.platformRole.role)) {
    redirect("/");
  }

  const t = await getTranslations();

  if (!plataformaMenuFor(session.platformRole.role).includes("reportes")) {
    return (
      <EmptyState title={t("common.noAccess")} description={t("plataforma.reportes.noAccessDescription")} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">{t("plataforma.reporteDetalle.heading")}</h1>
      <ReporteDetail reportId={reportId} readOnly={session.platformRole.role === "support"} />
    </div>
  );
}
