import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { BloqueosPanel } from "@/components/plataforma/BloqueosPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { isPlatformRole, plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.plataforma.bloqueos");
  return { title: t("title") };
}

const NUMERIC_ID = /^\d+$/;

export default async function PlataformaBloqueosPage({
  searchParams,
}: {
  searchParams?: Promise<{ user?: string | string[]; email?: string | string[] }>;
}) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!isPlatformRole(session.platformRole.role)) {
    redirect("/");
  }

  const t = await getTranslations();

  if (!plataformaMenuFor(session.platformRole.role).includes("bloqueos")) {
    return (
      <EmptyState title={t("common.noAccess")} description={t("plataforma.bloqueos.noAccessDescription")} />
    );
  }

  // Un `?user=` que no sea un id se ignora (el backend respondería 404):
  // se empieza sin cuenta elegida.
  const query = await searchParams;
  const rawUser = query?.user;
  const initialUserId = typeof rawUser === "string" && NUMERIC_ID.test(rawUser) ? rawUser : null;
  const rawEmail = query?.email;
  const initialEmail = initialUserId && typeof rawEmail === "string" && rawEmail.trim() ? rawEmail.trim() : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-text-base">{t("plataforma.bloqueos.heading")}</h1>
      <p className="text-sm text-text-secondary">{t("plataforma.bloqueos.intro")}</p>
      <BloqueosPanel key={initialUserId ?? "none"} initialUserId={initialUserId} initialEmail={initialEmail} />
    </div>
  );
}
