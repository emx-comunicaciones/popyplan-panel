import { redirect } from "next/navigation";

import { AppAccountScreen } from "@/components/landing/AppAccountScreen";
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
 *
 * Con sesión y `sin-acceso` se pinta `AppAccountScreen` (spec de diseño
 * `2026-09-20-landing-login-unico-design.md` §5): la cuenta existe y es
 * válida, solo que su sitio es la app, no el panel.
 */
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

  return <AppAccountScreen />;
}
