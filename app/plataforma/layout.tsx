import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { LogoutButton } from "@/components/LogoutButton";
import { PageHelp } from "@/components/help/PageHelp";
import { SkipLink } from "@/components/ui/SkipLink";
import { Footer } from "@/components/layout/Footer";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { SideNav } from "@/components/layout/SideNav";
import {
  PLATAFORMA_MENU_LABELS,
  isPlatformRole,
  plataformaMenuFor,
} from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export default async function PlataformaLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  // Un rol que no sea uno de los cuatro conocidos (backend nuevo, dato
  // corrupto) da un menú vacío: se trata igual que no tener rol y se
  // manda a la raíz, que reparte por área (hallazgo B20).
  if (!isPlatformRole(session.platformRole.role)) {
    redirect("/");
  }

  const menu = plataformaMenuFor(session.platformRole.role);

  return (
    <div className="flex min-h-screen flex-col bg-border-light">
      <SkipLink />
      <header className="flex items-center justify-between gap-3 bg-secondary-900 px-4 py-2 text-text-inverse">
        <span className="text-base font-semibold">{t("layout.plataforma.brand")}</span>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <PageHelp />
          <LogoutButton />
        </div>
      </header>
      <div className="flex flex-1">
        <SideNav
          ariaLabel={t("menu.plataforma.navLabel")}
          items={menu.map((item) => ({
            href: item === "inicio" ? "/plataforma" : `/plataforma/${item}`,
            label: t(PLATAFORMA_MENU_LABELS[item]),
          }))}
        />
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 focus:outline-none">
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
}
