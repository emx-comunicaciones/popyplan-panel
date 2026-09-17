import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ActividadesTable } from "@/components/entidad/ActividadesTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { entidadMenuFor } from "@/lib/auth/entidadMenu";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Asistencia" };

/**
 * «Asistencia» del menú: elegir la actividad cuya asistencia se quiere
 * gestionar (reutiliza `ActividadesTable`, cuyas filas ya enlazan a
 * `asistencia/{eventId}` — evita duplicar la tabla de actividades).
 */
export default async function EntidadAsistenciaIndexPage({
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

  if (!entidadMenuFor(membership.role).includes("asistencia")) {
    return <EmptyState title="Sin acceso" description="Tu rol no tiene acceso a Asistencia." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Asistencia</h1>
      <p className="text-sm text-text-secondary">Elige una actividad para gestionar su asistencia.</p>
      <ActividadesTable orgId={membership.organization_id} slug={slug} />
    </div>
  );
}
