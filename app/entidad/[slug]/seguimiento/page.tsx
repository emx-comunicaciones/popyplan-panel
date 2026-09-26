import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { SeguimientoPanel } from "@/components/entidad/SeguimientoPanel";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { entidadMenuFor } from "@/lib/auth/entidadMenu";
import { isTrackingProgramEnabled } from "@/lib/auth/organization";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.entidad.seguimiento");
  return { title: t("title") };
}

/**
 * Programa de seguimiento de la entidad (`docs/PANEL.md` §18.3): listado de
 * inscripciones con su **estado**, nunca datos de seguimiento. Solo
 * `titular`/`moderador` y solo con `tracking_program_enabled`.
 *
 * A diferencia del resto de gates de entidad (que pintan «Sin acceso»),
 * aquí cualquier otro caso es `notFound()`: el backend responde 404 a
 * quien no puede usar el programa para no revelar que existe, y la página
 * sigue el mismo criterio.
 */
export default async function EntidadSeguimientoPage({
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

  const trackingEnabled = await isTrackingProgramEnabled(membership.organization_id, session);
  if (!entidadMenuFor(membership.role, { trackingEnabled }).includes("seguimiento")) {
    notFound();
  }

  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text-base">{t("entidad.seguimiento.heading")}</h1>
      <SeguimientoPanel orgId={membership.organization_id} slug={slug} />
    </div>
  );
}
