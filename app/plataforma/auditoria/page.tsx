import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AuditoriaPanel } from "@/components/plataforma/AuditoriaPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { isPlatformRole, plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.plataforma.auditoria");
  return { title: t("title") };
}

export default async function PlataformaAuditoriaPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!isPlatformRole(session.platformRole.role)) {
    redirect("/");
  }

  if (!plataformaMenuFor(session.platformRole.role).includes("auditoria")) {
    return <EmptyState title="Sin acceso" description="Solo superadmin ve la auditoría de la plataforma." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Auditoría</h1>
      <AuditoriaPanel />
    </div>
  );
}
