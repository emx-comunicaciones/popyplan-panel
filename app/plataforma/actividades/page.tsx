import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ActividadesPlataformaTable } from "@/components/plataforma/ActividadesPlataformaTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { isPlatformRole, plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.plataforma.actividades");
  return { title: t("title") };
}

/** `Community.id` es un UUID: otra cosa en `?community=` se ignora (el backend daría 404). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PlataformaActividadesPage({
  searchParams,
}: {
  searchParams?: Promise<{ community?: string | string[] }>;
}) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!isPlatformRole(session.platformRole.role)) {
    redirect("/");
  }

  const t = await getTranslations();

  if (!plataformaMenuFor(session.platformRole.role).includes("actividades")) {
    return (
      <EmptyState title={t("common.noAccess")} description={t("plataforma.actividades.noAccessDescription")} />
    );
  }

  const raw = (await searchParams)?.community;
  const initialCommunityId = typeof raw === "string" && UUID.test(raw) ? raw : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text-base">{t("plataforma.actividades.heading")}</h1>
      <p className="text-sm text-text-secondary">{t("plataforma.actividades.intro")}</p>
      <ActividadesPlataformaTable key={initialCommunityId ?? "agenda"} initialCommunityId={initialCommunityId} />
    </div>
  );
}
