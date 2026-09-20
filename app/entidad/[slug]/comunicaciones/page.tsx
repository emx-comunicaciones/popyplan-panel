import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ComunicacionesPanel } from "@/components/entidad/ComunicacionesPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { entidadMenuFor } from "@/lib/auth/entidadMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.entidad.comunicaciones");
  return { title: t("title") };
}

export default async function EntidadComunicacionesPage({
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

  if (!entidadMenuFor(membership.role).includes("comunicaciones")) {
    return (
      <EmptyState
        title={t("common.noAccess")}
        description={t("entidad.comunicaciones.noAccessDescription")}
      />
    );
  }

  const canCompose = membership.role === "titular" || membership.role === "moderador";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text-base">{t("entidad.comunicaciones.heading")}</h1>
      <ComunicacionesPanel orgId={membership.organization_id} canCompose={canCompose} />
    </div>
  );
}
