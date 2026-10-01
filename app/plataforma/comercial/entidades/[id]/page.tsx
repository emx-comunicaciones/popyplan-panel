import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { CrmAccountDetailView } from "@/components/crm/CrmAccountDetailView";
import { EmptyState } from "@/components/ui/EmptyState";
import { isCrmManager, isCrmRole } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.plataforma.comercialEntidadFicha");
  return { title: t("title") };
}

/** CRM comercial: ver `docs/CRM.md` del backend y `app/plataforma/comercial/layout.tsx`. */
export default async function PlataformaComercialEntidadFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Los ids del CRM son enteros: cualquier otra cosa es una URL inventada.
  if (!/^\d+$/.test(id)) {
    notFound();
  }
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  const role = session.platformRole.role;
  const t = await getTranslations();
  if (!isCrmRole(role)) {
    return <EmptyState title={t("common.noAccess")} description={t("crm.shell.noAccess")} />;
  }
  return <CrmAccountDetailView id={Number(id)} isManager={isCrmManager(role)} userId={session.me.id} />;
}
