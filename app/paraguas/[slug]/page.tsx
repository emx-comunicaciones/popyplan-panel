import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ParaguasMetricsDashboard } from "@/components/metrics/ParaguasMetricsDashboard";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { getServerOrganization } from "@/lib/auth/organization";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Inicio del paraguas" };

export default async function ParaguasInicioPage({
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

  const orgResult = await getServerOrganization(membership.organization_id, session.token);
  const orgName = orgResult.ok ? orgResult.data.name : membership.organization_name;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text-base">Inicio</h1>
      <ParaguasMetricsDashboard orgId={membership.organization_id} orgName={orgName} />
    </div>
  );
}
