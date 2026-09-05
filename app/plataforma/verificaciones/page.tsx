import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VerificacionesQueue } from "@/components/plataforma/VerificacionesQueue";
import { EmptyState } from "@/components/ui/EmptyState";
import { plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Verificaciones" };

export default async function PlataformaVerificacionesPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!session.platformRole.role) {
    redirect("/");
  }

  if (!plataformaMenuFor(session.platformRole.role).includes("verificaciones")) {
    return <EmptyState title="Sin acceso" description="Tu rol no tiene acceso a Verificaciones." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Verificaciones</h1>
      <VerificacionesQueue />
    </div>
  );
}
