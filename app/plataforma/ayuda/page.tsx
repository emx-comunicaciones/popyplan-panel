import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AyudaPendienteList } from "@/components/plataforma/AyudaPendienteList";
import { EmptyState } from "@/components/ui/EmptyState";
import { plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Ayuda" };

export default async function PlataformaAyudaPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!session.platformRole.role) {
    redirect("/");
  }

  if (!plataformaMenuFor(session.platformRole.role).includes("ayuda")) {
    return <EmptyState title="Sin acceso" description="Tu rol no tiene acceso a Ayuda." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Ayuda</h1>
      <AyudaPendienteList />
    </div>
  );
}
