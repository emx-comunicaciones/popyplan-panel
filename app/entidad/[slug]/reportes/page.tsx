import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ReportesQueue } from "@/components/entidad/ReportesQueue";
import { EmptyState } from "@/components/ui/EmptyState";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { entidadMenuFor } from "@/lib/auth/entidadMenu";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Reportes de la entidad" };

export default async function EntidadReportesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  if (!entidadMenuFor(membership.role).includes("reportes")) {
    return <EmptyState title="Sin acceso" description="Tu rol no tiene acceso a Reportes." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Reportes</h1>
      <ReportesQueue orgId={membership.organization_id} slug={slug} />
    </div>
  );
}
