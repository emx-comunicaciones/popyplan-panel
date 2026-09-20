import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { PersonSheet } from "@/components/entidad/PersonSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { entidadMenuFor } from "@/lib/auth/entidadMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.entidad.personaFicha");
  return { title: t("title") };
}

/**
 * Ficha operativa de una persona de la entidad (`docs/PANEL.md` §3.3).
 * «Asignar referente» solo para `titular`/`moderador` (matriz de
 * `entities/permissions.py`, §8 de `SEGURIDAD_Y_MODERACION.md`).
 */
export default async function EntidadPersonaPage({
  params,
}: {
  params: Promise<{ slug: string; userId: string }>;
}) {
  const { slug, userId } = await params;
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

  if (!entidadMenuFor(membership.role).includes("personas")) {
    return (
      <EmptyState title={t("common.noAccess")} description={t("entidad.personas.noAccessDescription")} />
    );
  }

  const canAssignReferent = membership.role === "titular" || membership.role === "moderador";
  const isReferent = membership.role === "referente";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text-base">{t("entidad.personaFicha.heading")}</h1>
      <PersonSheet
        orgId={membership.organization_id}
        userId={userId}
        canAssignReferent={canAssignReferent}
        isReferent={isReferent}
      />
    </div>
  );
}
