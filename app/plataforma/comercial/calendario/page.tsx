import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { CrmCalendarView } from "@/components/crm/CrmCalendarView";
import { EmptyState } from "@/components/ui/EmptyState";
import { isCrmManager, isCrmRole } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.plataforma.comercialCalendario");
  return { title: t("title") };
}

/** CRM comercial: ver `docs/CRM.md` del backend y `app/plataforma/comercial/layout.tsx`. */
export default async function PlataformaComercialCalendarioPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  const role = session.platformRole.role;
  const t = await getTranslations();
  if (!isCrmRole(role)) {
    return <EmptyState title={t("common.noAccess")} description={t("crm.shell.noAccess")} />;
  }
  return <CrmCalendarView isManager={isCrmManager(role)} userId={session.me.id} />;
}
