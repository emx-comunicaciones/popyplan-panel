import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConfiguracionPanel } from "@/components/entidad/ConfiguracionPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import type { OrgMembershipForArea } from "@/lib/api/types";
import type { EntidadPanelRole } from "@/lib/auth/area";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { entidadMenuFor } from "@/lib/auth/entidadMenu";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Configuración de la entidad" };

export default async function EntidadConfiguracionPage({
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
    (m): m is OrgMembershipForArea & { role: EntidadPanelRole } =>
      m.organization_slug === slug && isEntidadPanelRole(m.role),
  );
  if (!membership) {
    redirect("/");
  }

  if (!entidadMenuFor(membership.role).includes("configuracion")) {
    return <EmptyState title="Sin acceso" description="Tu rol no tiene acceso a Configuración." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Configuración</h1>
      <ConfiguracionPanel
        orgId={membership.organization_id}
        role={membership.role}
        currentUserId={session.me.id}
      />
    </div>
  );
}
