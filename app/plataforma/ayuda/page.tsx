import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { AyudaPendienteList } from "@/components/plataforma/AyudaPendienteList";
import { EmptyState } from "@/components/ui/EmptyState";
import { isPlatformRole, plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.plataforma.ayuda");
  return { title: t("title") };
}

export default async function PlataformaAyudaPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!isPlatformRole(session.platformRole.role)) {
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
