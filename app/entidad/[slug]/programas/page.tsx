import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ProgramasPanel } from "@/components/entidad/ProgramasPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { entidadMenuFor } from "@/lib/auth/entidadMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.entidad.programas");
  return { title: t("title") };
}

/**
 * Programas de la entidad (`docs/PANEL.md` §12, tarea W3 de la Fase 6):
 * visible para todo rol con `ver_panel` (titular, moderador, dinamizador,
 * analista, referente); solo `titular`/`moderador` gestionan
 * (`gestionar_programas`, `ProgramasPanel::canManage`).
 */
export default async function EntidadProgramasPage({
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

  if (!entidadMenuFor(membership.role).includes("programas")) {
    return (
      <EmptyState title={t("common.noAccess")} description={t("entidad.programas.noAccessDescription")} />
    );
  }

  const canManage = membership.role === "titular" || membership.role === "moderador";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">{t("entidad.programas.heading")}</h1>
      <ProgramasPanel orgId={membership.organization_id} slug={slug} canManage={canManage} />
    </div>
  );
}
