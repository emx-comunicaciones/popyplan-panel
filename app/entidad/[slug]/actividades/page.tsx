import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ActividadesTable } from "@/components/entidad/ActividadesTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { entidadMenuFor } from "@/lib/auth/entidadMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.entidad.actividades");
  return { title: t("title") };
}

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

  const menu = entidadMenuFor(membership.role);
  if (!menu.includes("actividades")) {
    return <EmptyState title="Sin acceso" description="Tu rol no tiene acceso a Actividades." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Actividades</h1>
      <ActividadesTable
        orgId={membership.organization_id}
        slug={slug}
        // `referente` no tiene Asistencia en su menú: sin esto, el título
        // de cada actividad le enlazaba a una pantalla «Sin acceso».
        canOpenAttendance={menu.includes("asistencia")}
      />
    </div>
  );
}
