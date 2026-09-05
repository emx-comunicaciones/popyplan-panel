import { redirect } from "next/navigation";

import { AuditoriaPanel } from "@/components/plataforma/AuditoriaPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export default async function PlataformaAuditoriaPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!session.platformRole.role) {
    redirect("/");
  }

  if (!plataformaMenuFor(session.platformRole.role).includes("auditoria")) {
    return <EmptyState title="Sin acceso" description="Solo superadmin ve la auditoría de la plataforma." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Auditoría</h1>
      <AuditoriaPanel />
    </div>
  );
}
