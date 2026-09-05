import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ActividadesTable } from "@/components/entidad/ActividadesTable";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Actividades de la entidad" };

export default async function EntidadActividadesPage({
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

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Actividades</h1>
      <ActividadesTable orgId={membership.organization_id} slug={slug} />
    </div>
  );
}
