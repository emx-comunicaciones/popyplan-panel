import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/LogoutButton";
import { PageHelp } from "@/components/help/PageHelp";
import { SkipLink } from "@/components/ui/SkipLink";
import { ErrorState } from "@/components/ui/ErrorState";
import { Footer } from "@/components/layout/Footer";
import { contrastRatio, readableOn } from "@/lib/a11y/contrast";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { getServerOrganization } from "@/lib/auth/organization";
import { isPlatformRole } from "@/lib/auth/plataformaMenu";
import { PARAGUAS_MENU_LABELS, paraguasMenuFor } from "@/lib/auth/paraguasMenu";
import { getServerSession } from "@/lib/auth/session";
import { isAllowedImageSrc } from "@/lib/config/imagePatterns";

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
  if (isPlatformRole(session.platformRole.role)) {
    // Mismo criterio que `app/entidad/[slug]/layout.tsx`: solo un rol
    // de plataforma conocido manda sobre el panel de entidad paraguas.
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
  // `readableOn`/`contrastRatio` devuelven `null` cuando el color de
  // marca no es un hex calculable (vacío, un nombre CSS, un hex a
  // medias): «no calculable» cae al mismo tinte que un par ilegible.
  const headerContrast =
    primaryColor && headerText ? contrastRatio(headerText, primaryColor) : null;
  const headerIsLegible = !primaryColor || (headerContrast !== null && headerContrast >= 3);
  const headerBackground = headerIsLegible ? primaryColor || "var(--color-primary-700)" : "var(--color-primary-100)";
  const headerForeground = headerIsLegible && headerText ? headerText : "var(--color-text-base)";
  // La franja solo tiene sentido con un color que el navegador vaya a
  // pintar: si `primary_color` no es un hex calculable, una declaración
  // inválida dejaría la cabecera sin borde inferior de todos modos, así
  // que se usa el tinte decorativo de la marca.
  const headerAccent = headerIsLegible
    ? undefined
    : (primaryColor && headerText ? primaryColor : "var(--color-primary)");

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
          {/* `next/image` lanza en render si el host no está en
              `images.remotePatterns`: sin este guard, un logo servido
              desde un dominio que el despliegue no declaró tumbaba el
              layout entero a `app/error.tsx` (ver
              `lib/config/imagePatterns.ts::isAllowedImageSrc`). */}
          {org?.logo && isAllowedImageSrc(org.logo) ? (
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
        <div className="flex items-center gap-3">
          <PageHelp />
          <LogoutButton />
        </div>
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
