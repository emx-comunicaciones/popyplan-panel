import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ExportPanel } from "@/components/metrics/ExportPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { entidadMenuFor } from "@/lib/auth/entidadMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.entidad.informes");
  return { title: t("title") };
}

/**
 * Informes de la entidad (carry-over de la tarea W4a cerrado en W6,
 * pregunta 18 de `docs/preguntas-diseno.md`): exportación CSV/PDF del
 * mismo esquema de métricas que ya usa `ExportPanel` (`ámbito W2`), aquí
 * con `scope="entidad"`. Visible en el menú (`entidadMenuFor`) solo para
 * `titular`, `moderador` y `analista` — el mismo conjunto de roles que
 * el backend deja exportar (`PuedeEnEntidad('exportar_informes')`,
 * `docs/PANEL.md` §2.1); `dinamizador` y `referente` nunca la ven.
 */
export default async function EntidadInformesPage({
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

  if (!entidadMenuFor(membership.role).includes("informes")) {
    return (
      <EmptyState title={t("common.noAccess")} description={t("entidad.informes.noAccessDescription")} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text-base">{t("entidad.informes.heading")}</h1>
      <ExportPanel scope="entidad" orgId={membership.organization_id} />
    </div>
  );
}
