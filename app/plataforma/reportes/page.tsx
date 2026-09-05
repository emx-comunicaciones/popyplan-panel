import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ReportesQueuePlataforma } from "@/components/plataforma/ReportesQueuePlataforma";
import { EmptyState } from "@/components/ui/EmptyState";
import { plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Reportes de plataforma" };

export default async function PlataformaReportesPage() {
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
      <h1 className="text-2xl font-semibold text-text-base">Reportes</h1>
      <ReportesQueuePlataforma />
    </div>
  );
}
