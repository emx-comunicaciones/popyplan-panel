import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { EntityHomeDashboard } from "@/components/entidad/EntityHomeDashboard";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.entidad.inicio");
  return { title: t("title") };
}

export default async function EntidadInicioPage({
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

  const t = await getTranslations("entidad.inicio");

  // Sin subtítulo «Panel de <entidad>.» (pasada de densidad,
  // 2026-09-20): el nombre de la entidad ya preside la cabecera del
  // layout, así que la línea solo repetía un dato visible y empujaba el
  // contenido hacia abajo. Al quedarse sin él, esta página tampoco
  // necesita pedir la ficha de la entidad.
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text-base">{t("heading")}</h1>
      <EntityHomeDashboard orgId={membership.organization_id} slug={slug} />
    </div>
  );
}
