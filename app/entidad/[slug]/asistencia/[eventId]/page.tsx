import { redirect } from "next/navigation";

import { AttendanceView } from "@/components/entidad/AttendanceView";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { getServerSession } from "@/lib/auth/session";

/**
 * Asistencia de una actividad (`docs/PANEL.md` §4): marcar asistencia
 * manual y check-in por QR. El backend exige ser quien organiza esa
 * actividad concreta (`IsOrganizerOrReadOnly`); esta página solo exige
 * tener algún rol de panel en la entidad — un 403 real al marcar o dar
 * check-in lo pinta el propio componente (`AttendanceView`).
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

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Asistencia</h1>
      <AttendanceView eventId={eventId} />
    </div>
  );
}
