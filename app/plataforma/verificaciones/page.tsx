import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { VerificacionesQueue } from "@/components/plataforma/VerificacionesQueue";
import { EmptyState } from "@/components/ui/EmptyState";
import { isPlatformRole, plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.plataforma.verificaciones");
  return { title: t("title") };
}

export default async function PlataformaVerificacionesPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!isPlatformRole(session.platformRole.role)) {
    redirect("/");
  }

  const t = await getTranslations();

  if (!plataformaMenuFor(session.platformRole.role).includes("verificaciones")) {
    return (
      <EmptyState title={t("common.noAccess")} description={t("plataforma.verificaciones.noAccessDescription")} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">{t("plataforma.verificaciones.heading")}</h1>
      <VerificacionesQueue />
    </div>
  );
}
