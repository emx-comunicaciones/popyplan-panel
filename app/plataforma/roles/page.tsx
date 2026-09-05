import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RolesPanel } from "@/components/plataforma/RolesPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Roles de plataforma" };

export default async function PlataformaRolesPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!session.platformRole.role) {
    redirect("/");
  }

  if (!plataformaMenuFor(session.platformRole.role).includes("roles")) {
    return <EmptyState title="Sin acceso" description="Solo superadmin gestiona los roles de plataforma." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Roles</h1>
      <RolesPanel />
    </div>
  );
}
