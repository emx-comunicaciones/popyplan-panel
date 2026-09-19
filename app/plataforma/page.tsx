import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { PlataformaHomeDashboard } from "@/components/plataforma/PlataformaHomeDashboard";
import { isPlatformRole } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.plataforma.inicio");
  return { title: t("title") };
}

export default async function PlataformaInicioPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!isPlatformRole(session.platformRole.role)) {
    redirect("/");
  }

  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">{t("plataforma.inicio.heading")}</h1>
      <PlataformaHomeDashboard role={session.platformRole.role} />
    </div>
  );
}
