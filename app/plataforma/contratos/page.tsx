import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ContratosPanel } from "@/components/plataforma/ContratosPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Contratos" };

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
  if (!session.platformRole.role) {
    redirect("/");
  }

  if (!plataformaMenuFor(session.platformRole.role).includes("contratos")) {
    return (
      <EmptyState
        title="Sin acceso"
        description="Solo superadmin y support ven la contratación y facturación de plataforma."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Contratos</h1>
      <ContratosPanel role={session.platformRole.role} />
    </div>
  );
}
