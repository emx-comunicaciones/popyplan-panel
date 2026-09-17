import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/LogoutButton";
import { SkipLink } from "@/components/ui/SkipLink";
import { ErrorState } from "@/components/ui/ErrorState";
import { Footer } from "@/components/layout/Footer";
import { contrastRatio, readableOn } from "@/lib/a11y/contrast";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { ENTIDAD_MENU_LABELS, entidadMenuFor } from "@/lib/auth/entidadMenu";
import { getServerOrganization } from "@/lib/auth/organization";
import { isPlatformRole } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export default async function EntidadLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (isPlatformRole(session.platformRole.role)) {
    // El rol de plataforma manda: no navega el panel de entidad
    // (lib/auth/area.ts). Solo uno de los cuatro roles conocidos, para
    // no rebotar contra el layout de plataforma, que devuelve a `/`
    // cualquier otro (bucle de redirecciones).
    redirect("/plataforma");
  }

  const membership = session.me.org_memberships.find(
    (m) => m.organization_slug === slug && isEntidadPanelRole(m.role),
  );
  if (!membership) {
    // Ni esta entidad ni ningún rol con panel: que la home decida a dónde.
    redirect("/");
  }

  const orgResult = await getServerOrganization(membership.organization_id, session.token);

  const menu = entidadMenuFor(membership.role);
  const org = orgResult.ok ? orgResult.data : null;
  // Cabecera de entidad con color de marca (tarea W1, Fase 6): el color
  // de la entidad no pinta texto directamente. `readableOn` calcula el
  // texto legible (blanco o el oscuro de la app); si aun así el par no
  // llega a 3:1 (defensivo: no ocurre con las dos opciones de
  // `readableOn` hoy, ver su docstring, pero cubre un dato de marca
  // fuera de lo esperado), la cabecera cae al tinte claro
  // `--color-primary-100` con texto oscuro y una franja de 6px del
  // color de la entidad de borde inferior, en vez de arriesgar texto
  // ilegible.
  const primaryColor = org?.primary_color || null;
  const headerText = primaryColor ? readableOn(primaryColor) : "#FFFFFF";
  const headerIsLegible = !primaryColor || contrastRatio(headerText, primaryColor) >= 3;
  const headerBackground = headerIsLegible ? primaryColor || "var(--color-primary-700)" : "var(--color-primary-100)";
  const headerForeground = headerIsLegible ? headerText : "var(--color-text-base)";
  const headerAccent = headerIsLegible ? undefined : (primaryColor ?? undefined);

  return (
    <div className="flex min-h-screen flex-col bg-border-light">
      <SkipLink />
      <header
        className="flex items-center justify-between gap-4 px-6 py-4"
        style={{
          backgroundColor: headerBackground,
          color: headerForeground,
          borderBottom: headerAccent ? `6px solid ${headerAccent}` : undefined,
        }}
      >
        <div className="flex items-center gap-3">
          {org?.logo ? (
            <Image
              src={org.logo}
              alt=""
              width={36}
              height={36}
              className="rounded-full bg-white object-contain"
            />
          ) : null}
          <span className="text-lg font-semibold">{org?.name ?? membership.organization_name}</span>
        </div>
        <LogoutButton />
      </header>
      {!orgResult.ok ? (
        <div className="p-4">
          <ErrorState
            title="No se pudo cargar la ficha de la entidad"
            description="Los datos de contacto y colores no están disponibles ahora mismo."
          />
        </div>
      ) : null}
      <div className="flex flex-1">
        <nav aria-label="Secciones de la entidad" className="w-56 shrink-0 border-r border-border bg-white p-4">
          <ul className="flex flex-col gap-1">
            {menu.map((item) => (
              <li key={item}>
                <Link
                  href={item === "inicio" ? `/entidad/${slug}` : `/entidad/${slug}/${item}`}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-text-form hover:bg-border-light"
                >
                  {ENTIDAD_MENU_LABELS[item]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main id="main-content" tabIndex={-1} className="flex-1 p-6 focus:outline-none">
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
}
