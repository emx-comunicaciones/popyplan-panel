import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { PlataformaMetricsDashboard } from "@/components/metrics/PlataformaMetricsDashboard";
import { EmptyState } from "@/components/ui/EmptyState";
import { isPlatformRole, plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.plataforma.metricas");
  return { title: t("title") };
}

export default async function PlataformaMetricasPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!isPlatformRole(session.platformRole.role)) {
    redirect("/");
  }

  if (!plataformaMenuFor(session.platformRole.role).includes("metricas")) {
    return <EmptyState title="Sin acceso" description="Tu rol no tiene acceso a Métricas." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text-base">Métricas</h1>
      <PlataformaMetricsDashboard />
    </div>
  );
}
