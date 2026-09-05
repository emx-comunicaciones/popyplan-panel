import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PersonasTable } from "@/components/entidad/PersonasTable";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Personas" };

export default async function EntidadPersonasPage({
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

  const canManage = membership.role === "titular" || membership.role === "moderador";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Personas</h1>
      <PersonasTable orgId={membership.organization_id} slug={slug} canManage={canManage} />
    </div>
  );
}
