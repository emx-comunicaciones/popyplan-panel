import { redirect } from "next/navigation";

import { EntidadDetail } from "@/components/plataforma/EntidadDetail";
import { EmptyState } from "@/components/ui/EmptyState";
import { plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export default async function PlataformaEntidadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
