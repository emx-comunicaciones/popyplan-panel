import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ProgramaDetalle } from "@/components/entidad/ProgramaDetalle";
import { EmptyState } from "@/components/ui/EmptyState";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { entidadMenuFor } from "@/lib/auth/entidadMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.entidad.programaFicha");
  return { title: t("title") };
}

/**
 * Ficha de un programa (`docs/PANEL.md` §12): activar/cerrar/editar solo
 * `titular`/`moderador` (`gestionar_programas`); descargar el informe
 * final también `analista` (`exportar_informes`, misma matriz que
 * Informes, `docs/PANEL.md` §2.1).
 */
export default async function EntidadProgramaPage({
  params,
}: {
  params: Promise<{ slug: string; programId: string }>;
}) {
  const { slug, programId } = await params;
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

  if (!entidadMenuFor(membership.role).includes("programas")) {
    return (
      <EmptyState title={t("common.noAccess")} description={t("entidad.programas.noAccessDescription")} />
    );
  }

  const canManage = membership.role === "titular" || membership.role === "moderador";
  const canExport = canManage || membership.role === "analista";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">{t("entidad.programaFicha.heading")}</h1>
      <ProgramaDetalle
        orgId={membership.organization_id}
        programId={programId}
        canManage={canManage}
        canExport={canExport}
      />
    </div>
  );
}
