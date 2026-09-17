import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EntidadDetail } from "@/components/plataforma/EntidadDetail";
import { EmptyState } from "@/components/ui/EmptyState";
import { plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Ficha de la entidad (plataforma)" };

/**
 * `Organization.id` es un entero en el backend (`/api/organizations/{id}/`):
 * cualquier otra cosa en la ruta es una URL inventada, no una entidad que
 * el backend pueda tener — se responde 404 sin llegar a pedirla, en vez de
 * pintar la ficha con un error de carga dentro (hallazgo B8).
 */
const NUMERIC_ID = /^\d+$/;

export default async function PlataformaEntidadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!NUMERIC_ID.test(id)) {
    notFound();
  }

  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!session.platformRole.role) {
    redirect("/");
  }

  if (!plataformaMenuFor(session.platformRole.role).includes("entidades")) {
    return <EmptyState title="Sin acceso" description="Tu rol no tiene acceso a Entidades." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Ficha de la entidad</h1>
      <EntidadDetail orgId={id} role={session.platformRole.role} />
    </div>
  );
}
