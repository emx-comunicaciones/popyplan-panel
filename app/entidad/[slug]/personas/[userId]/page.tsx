import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PersonSheet } from "@/components/entidad/PersonSheet";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Ficha de la persona" };

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

  const canAssignReferent = membership.role === "titular" || membership.role === "moderador";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Ficha de la persona</h1>
      <PersonSheet
        orgId={membership.organization_id}
        userId={userId}
        canAssignReferent={canAssignReferent}
      />
    </div>
  );
}
