import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { LogoutButton } from "@/components/LogoutButton";
import { ErrorState } from "@/components/ui/ErrorState";
import { resolveArea } from "@/lib/auth/area";
import { getServerSession } from "@/lib/auth/session";

/**
 * Reparto de la raíz: manda a cada persona al área que le corresponde.
 *
 * Depende del middleware: `getServerSession()` solo lee la cabecera
 * interna `x-pp-access-token` que pone `middleware.ts` tras refrescar la
 * cookie, así que esta ruta **tiene que estar en su `matcher`** (hallazgo
 * A2: no lo estaba, y con la sesión viva la raíz siempre acababa en
 * `/login` — con ella, todos los `redirect("/")` de los layouts
 * —slug ajeno, rol de plataforma revocado— parecían un cierre de sesión y
 * el estado «sin acceso» de abajo era inalcanzable).
 */
export default async function Home() {
  const t = await getTranslations("pages.home");
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
        title={t("noAccessTitle")}
        description={t("noAccessDescription")}
        action={<LogoutButton />}
      />
    </main>
  );
}
