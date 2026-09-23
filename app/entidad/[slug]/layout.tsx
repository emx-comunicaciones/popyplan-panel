import Image from "next/image";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHelp } from "@/components/help/PageHelp";
import { SkipLink } from "@/components/ui/SkipLink";
import { ErrorState } from "@/components/ui/ErrorState";
import { Footer } from "@/components/layout/Footer";
import { UserMenu } from "@/components/layout/UserMenu";
import { displayName } from "@/lib/auth/displayName";
import { SideNav } from "@/components/layout/SideNav";
import { contrastRatio, readableOn } from "@/lib/a11y/contrast";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { ENTIDAD_MENU_LABELS, entidadMenuFor } from "@/lib/auth/entidadMenu";
import { getServerOrganization } from "@/lib/auth/organization";
import { isPlatformRole } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";
import { isAllowedImageSrc } from "@/lib/config/imagePatterns";

export default async function EntidadLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations();
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

  const orgResult = await getServerOrganization(
    membership.organization_id,
    session.token,
  );

  const org = orgResult.ok ? orgResult.data : null;
  // D-I8: la persona de guardia ve «Guardia» sea cual sea su rol — el
  // backend autoriza `pending` con `es_guardia or moderar`. La ficha ya
  // está pedida aquí arriba, así que no cuesta ninguna petición más.
  const menu = entidadMenuFor(membership.role, {
    isOnCall: org?.on_call_user === session.me.id,
  });
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
  // `readableOn`/`contrastRatio` devuelven `null` cuando el color de
  // marca no es un hex calculable (vacío, un nombre CSS, un hex a
  // medias): «no calculable» cae al mismo tinte que un par ilegible.
  const headerContrast =
    primaryColor && headerText ? contrastRatio(headerText, primaryColor) : null;
  const headerIsLegible =
    !primaryColor || (headerContrast !== null && headerContrast >= 3);
  const headerBackground = headerIsLegible
    ? primaryColor || "var(--color-primary-700)"
    : "var(--color-primary-100)";
  const headerForeground =
    headerIsLegible && headerText ? headerText : "var(--color-text-base)";
  // La franja solo tiene sentido con un color que el navegador vaya a
  // pintar: si `primary_color` no es un hex calculable, una declaración
  // inválida dejaría la cabecera sin borde inferior de todos modos, así
  // que se usa el tinte decorativo de la marca.
  const headerAccent = headerIsLegible
    ? undefined
    : primaryColor && headerText
      ? primaryColor
      : "var(--color-primary)";

  return (
    <div className="flex min-h-screen flex-col bg-border-light">
      <SkipLink />
      <header
        className="flex items-center justify-between gap-3 px-4 py-2"
        style={{
          backgroundColor: headerBackground,
          color: headerForeground,
          borderBottom: headerAccent ? `6px solid ${headerAccent}` : undefined,
        }}
      >
        <div className="flex items-center gap-2">
          {/* `next/image` lanza en render si el host no está en
              `images.remotePatterns`: sin este guard, un logo servido
              desde un dominio que el despliegue no declaró tumbaba el
              layout entero a `app/error.tsx` (ver
              `lib/config/imagePatterns.ts::isAllowedImageSrc`). */}
          {org?.logo && isAllowedImageSrc(org.logo) ? (
            <Image
              src={org.logo}
              alt=""
              width={28}
              height={28}
              className="rounded-full bg-white object-contain"
            />
          ) : null}
          <span className="text-base font-semibold">
            {org?.name ?? membership.organization_name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <PageHelp visibleSections={menu} />
          <UserMenu email={session.me.email} name={displayName(session.me)} />
        </div>
      </header>
      {!orgResult.ok ? (
        <div className="p-3">
          <ErrorState
            title={t("layout.entidad.loadErrorTitle")}
            description={t("layout.entidad.loadErrorDescription")}
          />
        </div>
      ) : null}
      <div className="flex flex-1">
        <SideNav
          ariaLabel={t("menu.entidad.navLabel")}
          items={menu.map((item) => ({
            href:
              item === "inicio"
                ? `/entidad/${slug}`
                : `/entidad/${slug}/${item}`,
            label: t(ENTIDAD_MENU_LABELS[item]),
          }))}
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 p-4 focus:outline-none"
        >
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
}
