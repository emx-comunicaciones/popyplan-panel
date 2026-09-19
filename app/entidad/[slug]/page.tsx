import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { EntityHomeDashboard } from "@/components/entidad/EntityHomeDashboard";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { getServerOrganization } from "@/lib/auth/organization";
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

  const orgResult = await getServerOrganization(membership.organization_id, session.token);
  const orgName = orgResult.ok ? orgResult.data.name : membership.organization_name;
  const t = await getTranslations("entidad.inicio");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">{t("heading")}</h1>
      <p className="text-sm text-text-secondary">{t("panelSubtitle", { orgName })}</p>
      <EntityHomeDashboard orgId={membership.organization_id} slug={slug} />
    </div>
  );
}
