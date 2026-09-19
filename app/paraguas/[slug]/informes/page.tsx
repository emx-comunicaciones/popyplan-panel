import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ExportPanel } from "@/components/metrics/ExportPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { paraguasMenuFor } from "@/lib/auth/paraguasMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.paraguas.informes");
  return { title: t("title") };
}

export default async function ParaguasInformesPage({
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

  if (!paraguasMenuFor(membership.role).includes("informes")) {
    return (
      <EmptyState title={t("common.noAccess")} description={t("paraguas.informes.noAccessDescription")} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text-base">{t("paraguas.informes.heading")}</h1>
      <ExportPanel
        scope="territorio"
        orgId={membership.organization_id}
        scopeChoices={["territorio", "paraguas"]}
      />
    </div>
  );
}
