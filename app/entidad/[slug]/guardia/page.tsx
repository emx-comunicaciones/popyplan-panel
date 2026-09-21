import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { GuardiaPanel } from "@/components/entidad/GuardiaPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { entidadMenuFor } from "@/lib/auth/entidadMenu";
import { isOnCallUser } from "@/lib/auth/organization";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.entidad.guardia");
  return { title: t("title") };
}

export default async function EntidadGuardiaPage({
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

  // El backend deja ver los avisos a la guardia de la entidad aunque su
  // rol no sea titular/moderador (D-I8), así que el gate mira las dos
  // cosas, igual que `HelpRequestViewSet.pending`.
  const isOnCall = await isOnCallUser(membership.organization_id, session);

  const menu = entidadMenuFor(membership.role, { isOnCall });

  if (!menu.includes("guardia")) {
    return (
      <EmptyState title={t("common.noAccess")} description={t("entidad.guardia.noAccessDescription")} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text-base">{t("entidad.guardia.heading")}</h1>
      <GuardiaPanel
        orgId={membership.organization_id}
        slug={slug}
        // I1: una analista o un dinamizador de guardia ven esta pantalla
        // pero no tienen Personas; sin esto, el nombre de cada aviso les
        // enlazaba a un «Sin acceso» a página completa.
        canOpenPersonSheet={menu.includes("personas")}
        // M2: `PATCH /api/organizations/{id}/` exige `equipo`, que el
        // backend concede solo al titular; el resto veía un formulario
        // que siempre terminaba en 403.
        canManage={membership.role === "titular"}
      />
    </div>
  );
}
