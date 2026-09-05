import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/LogoutButton";
import { SkipLink } from "@/components/ui/SkipLink";
import { ErrorState } from "@/components/ui/ErrorState";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import { serverFetch } from "@/lib/api/serverFetch";
import type { Organization } from "@/lib/api/types";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { ENTIDAD_MENU_LABELS, entidadMenuFor } from "@/lib/auth/entidadMenu";
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
  if (session.platformRole.role) {
    // El rol de plataforma manda: no navega el panel de entidad (lib/auth/area.ts).
    redirect("/plataforma");
  }

  const membership = session.me.org_memberships.find(
    (m) => m.organization_slug === slug && isEntidadPanelRole(m.role),
  );
  if (!membership) {
    // Ni esta entidad ni ningún rol con panel: que la home decida a dónde.
    redirect("/");
  }

  const orgResult = await serverFetch<Organization>(
    ORGANIZATIONS.DETAIL(membership.organization_id),
    session.token,
  );

  const menu = entidadMenuFor(membership.role);
  const org = orgResult.ok ? orgResult.data : null;
  const headerColor = org?.primary_color || "var(--color-primary)";

  return (
    <div className="min-h-screen bg-border-light">
      <SkipLink />
      <header
        className="flex items-center justify-between gap-4 px-6 py-4 text-text-inverse"
        style={{ backgroundColor: headerColor }}
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
      <div className="flex">
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
    </div>
  );
}
