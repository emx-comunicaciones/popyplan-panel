import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ContratosPanel } from "@/components/plataforma/ContratosPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { isPlatformRole, plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.plataforma.suscripciones");
  return { title: t("title") };
}

/**
 * Suscripciones (contratos y facturación, `docs/PANEL.md` §13, tarea B4
 * backend / W4 panel; renombrada a «Suscripciones» en el bloque 1 de
 * territorio, §4.5 — el objeto de dominio sigue siendo `Contract`, ver
 * `lib/auth/plataformaMenu.ts`): visible en el menú solo para
 * `superadmin`/`support` (lectura de `billing`); la escritura la acota
 * el propio `ContratosPanel.tsx` a `superadmin` (botones ocultos para
 * `support`, no deshabilitados).
 */
export default async function PlataformaSuscripcionesPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!isPlatformRole(session.platformRole.role)) {
    redirect("/");
  }

  const t = await getTranslations();

  if (!plataformaMenuFor(session.platformRole.role).includes("suscripciones")) {
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
