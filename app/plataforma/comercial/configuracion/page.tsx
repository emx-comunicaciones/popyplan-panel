import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { CrmSettingsView } from "@/components/crm/CrmSettingsView";
import { EmptyState } from "@/components/ui/EmptyState";
import { isCrmManager, isCrmRole } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.plataforma.comercialConfiguracion");
  return { title: t("title") };
}

/** CRM comercial: ver `docs/CRM.md` del backend y `app/plataforma/comercial/layout.tsx`. */
export default async function PlataformaComercialConfiguracionPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  const role = session.platformRole.role;
  const t = await getTranslations();
  if (!isCrmRole(role)) {
    return <EmptyState title={t("common.noAccess")} description={t("crm.shell.noAccess")} />;
  }
  if (!isCrmManager(role)) {
    return <EmptyState title={t("common.noAccess")} description={t("crm.settings.noAccess")} />;
  }
  return <CrmSettingsView isManager={isCrmManager(role)} userId={session.me.id} />;
}
