import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/LogoutButton";
import { SkipLink } from "@/components/ui/SkipLink";
import { ErrorState } from "@/components/ui/ErrorState";
import { Footer } from "@/components/layout/Footer";
import { contrastRatio, readableOn } from "@/lib/a11y/contrast";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { getServerOrganization } from "@/lib/auth/organization";
import { PARAGUAS_MENU_LABELS, paraguasMenuFor } from "@/lib/auth/paraguasMenu";
import { getServerSession } from "@/lib/auth/session";

export default async function ParaguasLayout({
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
    redirect("/plataforma");
  }

  const membership = session.me.org_memberships.find(
    (m) => m.organization_slug === slug && isEntidadPanelRole(m.role),
  );
  if (!membership) {
    redirect("/");
  }

  const orgResult = await getServerOrganization(membership.organization_id, session.token);
  const menu = paraguasMenuFor(membership.role);
  const org = orgResult.ok ? orgResult.data : null;
  // Misma lógica de cabecera legible que `app/entidad/[slug]/layout.tsx`
  // (tarea W1, Fase 6): el color de marca de la entidad paraguas tampoco
  // pinta texto directamente.
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
          <ErrorState title="No se pudo cargar la ficha de la entidad paraguas" />
        </div>
      ) : null}
      <div className="flex flex-1">
        <nav aria-label="Secciones de la entidad paraguas" className="w-56 shrink-0 border-r border-border bg-white p-4">
          <ul className="flex flex-col gap-1">
            {menu.map((item) => (
              <li key={item}>
                <Link
                  href={item === "inicio" ? `/paraguas/${slug}` : `/paraguas/${slug}/${item}`}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-text-form hover:bg-border-light"
                >
                  {PARAGUAS_MENU_LABELS[item]}
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
