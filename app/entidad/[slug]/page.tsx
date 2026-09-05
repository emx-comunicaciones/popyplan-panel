import { redirect } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import { serverFetch } from "@/lib/api/serverFetch";
import type { Organization } from "@/lib/api/types";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { getServerSession } from "@/lib/auth/session";

export default async function EntidadInicioPage({
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

  const orgResult = await serverFetch<Organization>(
    ORGANIZATIONS.DETAIL(membership.organization_id),
    session.token,
  );
  const orgName = orgResult.ok ? orgResult.data.name : membership.organization_name;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Inicio</h1>
      <Card title="Tu entidad">
        <p className="text-text-base">{orgName}</p>
        <p className="mt-1 text-sm text-text-secondary">
          Panel de {orgName}. Las métricas de personas, asistencia y comunidades llegan
          en la siguiente tarea de esta fase.
        </p>
      </Card>
    </div>
  );
}
