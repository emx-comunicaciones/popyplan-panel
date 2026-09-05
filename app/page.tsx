import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/LogoutButton";
import { ErrorState } from "@/components/ui/ErrorState";
import { resolveArea } from "@/lib/auth/area";
import { getServerSession } from "@/lib/auth/session";

export default async function Home() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  const area = resolveArea(session.me, session.platformRole);

  if (area === "plataforma") {
    redirect("/plataforma");
  }
  if (area !== "sin-acceso") {
    if (area.kind === "entidad") redirect(`/entidad/${area.slug}`);
    if (area.kind === "paraguas") redirect(`/paraguas/${area.slug}`);
    redirect("/elegir-entidad");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <ErrorState
        title="No tienes acceso a ningún área del panel"
        description="Tu cuenta no tiene ningún rol de plataforma ni de entidad con panel asignado. Contacta con quien gestiona tu entidad o con Popyplan."
        action={<LogoutButton />}
      />
    </main>
  );
}
