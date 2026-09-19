import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ContratosPanel } from "@/components/plataforma/ContratosPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { isPlatformRole, plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.plataforma.contratos");
  return { title: t("title") };
}

/**
 * Contratos y facturación (`docs/PANEL.md` §13, tarea B4 backend / W4
 * panel): visible en el menú solo para `superadmin`/`support`
 * (`lib/auth/plataformaMenu.ts`, lectura de `billing`); la escritura la
 * acota el propio `ContratosPanel.tsx` a `superadmin` (botones ocultos
 * para `support`, no deshabilitados).
 */
export default async function PlataformaContratosPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!isPlatformRole(session.platformRole.role)) {
    redirect("/");
  }

  const t = await getTranslations();

  if (!plataformaMenuFor(session.platformRole.role).includes("contratos")) {
    return (
      <EmptyState
        title={t("common.noAccess")}
        description={t("plataforma.contratos.noAccessDescription")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">{t("plataforma.contratos.heading")}</h1>
      <ContratosPanel role={session.platformRole.role} />
    </div>
  );
}
