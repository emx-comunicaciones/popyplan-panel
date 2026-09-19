import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { EntidadesTable } from "@/components/plataforma/EntidadesTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { isPlatformRole, plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.plataforma.entidades");
  return { title: t("title") };
}

export default async function PlataformaEntidadesPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!isPlatformRole(session.platformRole.role)) {
    redirect("/");
  }

  const t = await getTranslations();

  if (!plataformaMenuFor(session.platformRole.role).includes("entidades")) {
    return (
      <EmptyState title={t("common.noAccess")} description={t("plataforma.entidades.noAccessDescription")} />
    );
  }

  const canCreate = session.platformRole.role === "verifier" || session.platformRole.role === "superadmin";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">{t("plataforma.entidades.heading")}</h1>
      <EntidadesTable canCreate={canCreate} />
    </div>
  );
}
