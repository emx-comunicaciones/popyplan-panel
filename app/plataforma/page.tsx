import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PlataformaHomeDashboard } from "@/components/plataforma/PlataformaHomeDashboard";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Inicio de plataforma" };

export default async function PlataformaInicioPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!session.platformRole.role) {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text-base">Inicio</h1>
      <PlataformaHomeDashboard role={session.platformRole.role} />
    </div>
  );
}
