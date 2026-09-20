import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ActividadesTable } from "@/components/entidad/ActividadesTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { entidadMenuFor } from "@/lib/auth/entidadMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.entidad.asistencia");
  return { title: t("title") };
}

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

  const t = await getTranslations();

  if (!entidadMenuFor(membership.role).includes("asistencia")) {
    return (
      <EmptyState title={t("common.noAccess")} description={t("entidad.asistencia.noAccessDescription")} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text-base">{t("entidad.asistencia.heading")}</h1>
      <p className="text-sm text-text-secondary">{t("entidad.asistencia.chooseActivity")}</p>
      {/* Siempre `true`: esta página ya está gateada por `asistencia`. */}
      <ActividadesTable orgId={membership.organization_id} slug={slug} canOpenAttendance />
    </div>
  );
}
