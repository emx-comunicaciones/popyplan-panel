import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AttendanceView } from "@/components/entidad/AttendanceView";
import { EmptyState } from "@/components/ui/EmptyState";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { entidadMenuFor } from "@/lib/auth/entidadMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.entidad.asistenciaEvento");
  return { title: t("title") };
}

/**
 * Asistencia de una actividad (`docs/PANEL.md` §4): marcar asistencia
 * manual y check-in por QR. La página exige que «Asistencia» esté en el
 * menú del rol (`entidadMenuFor`, igual que `asistencia/page.tsx`), así
 * que `analista` y `referente` ven «Sin acceso» en vez de la lista
 * nominal. El backend exige además ser quien organiza esa actividad
 * concreta (`IsOrganizerOrReadOnly`), que esta página no puede saber de
 * antemano — un 403 real al marcar o dar check-in lo pinta el propio
 * componente (`AttendanceView`).
 */
export default async function EntidadAsistenciaPage({
  params,
}: {
  params: Promise<{ slug: string; eventId: string }>;
}) {
  const { slug, eventId } = await params;
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
      <AttendanceView eventId={eventId} orgId={membership.organization_id} />
    </div>
  );
}
