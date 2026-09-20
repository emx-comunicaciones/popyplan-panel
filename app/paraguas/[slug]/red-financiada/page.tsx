import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ParaguasMetricsDashboard } from "@/components/metrics/ParaguasMetricsDashboard";
import { EmptyState } from "@/components/ui/EmptyState";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { getServerOrganization } from "@/lib/auth/organization";
import { paraguasMenuFor } from "@/lib/auth/paraguasMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.paraguas.redFinanciada");
  return { title: t("title") };
}

/**
 * Red financiada del área de administración (spec de diseño
 * `2026-09-19-territorio-administraciones-design.md` §4.1): el
 * dashboard de paraguas de siempre (`ParaguasMetricsDashboard`, sobre el
 * árbol `parent`/`children`), ahora bajo su propia ruta en vez de vivir
 * en Inicio — Inicio pasa a ser un resumen de dos bloques
 * (`ParaguasHomeDashboard`). Solo pide `ver_panel`, así que la ven los
 * cinco roles de la administración, igual que Territorio.
 */
export default async function ParaguasRedFinanciadaPage({
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

  if (!paraguasMenuFor(membership.role).includes("red-financiada")) {
    return (
      <EmptyState
        title={t("common.noAccess")}
        description={t("paraguas.redFinanciada.noAccessDescription")}
      />
    );
  }

  const orgResult = await getServerOrganization(membership.organization_id, session.token);
  const orgName = orgResult.ok ? orgResult.data.name : membership.organization_name;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text-base">
        {t("paraguas.redFinanciada.heading")}
      </h1>
      <ParaguasMetricsDashboard orgId={membership.organization_id} orgName={orgName} />
    </div>
  );
}
