import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ReporteDetail } from "@/components/entidad/ReporteDetail";
import { EmptyState } from "@/components/ui/EmptyState";
import { plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Detalle de reporte (plataforma)" };

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
  if (!session.platformRole.role) {
    redirect("/");
  }

  if (!plataformaMenuFor(session.platformRole.role).includes("reportes")) {
    return <EmptyState title="Sin acceso" description="Tu rol no tiene acceso a Reportes." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Reporte</h1>
      <ReporteDetail reportId={reportId} readOnly={session.platformRole.role === "support"} />
    </div>
  );
}
