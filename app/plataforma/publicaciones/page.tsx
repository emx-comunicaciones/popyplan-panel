import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { PublicacionesTable } from "@/components/plataforma/PublicacionesTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { isPlatformRole, plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.plataforma.publicaciones");
  return { title: t("title") };
}

export default async function PlataformaPublicacionesPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!isPlatformRole(session.platformRole.role)) {
    redirect("/");
  }

  const t = await getTranslations();

  if (!plataformaMenuFor(session.platformRole.role).includes("publicaciones")) {
    return <EmptyState title={t("common.noAccess")} description={t("plataforma.publicaciones.noAccessDescription")} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text-base">{t("plataforma.publicaciones.heading")}</h1>
      <p className="text-sm text-text-secondary">{t("plataforma.publicaciones.intro")}</p>
      <PublicacionesTable />
    </div>
  );
}
