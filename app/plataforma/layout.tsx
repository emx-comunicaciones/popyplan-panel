import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/LogoutButton";
import { SkipLink } from "@/components/ui/SkipLink";
import { PLATAFORMA_MENU_LABELS, plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export default async function PlataformaLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!session.platformRole.role) {
    redirect("/");
  }

  const menu = plataformaMenuFor(session.platformRole.role);

  return (
    <div className="min-h-screen bg-border-light">
      <SkipLink />
      <header className="flex items-center justify-between gap-4 bg-secondary-900 px-6 py-4 text-text-inverse">
        <span className="text-lg font-semibold">Popyplan · Plataforma</span>
        <LogoutButton />
      </header>
      <div className="flex">
        <nav aria-label="Secciones de plataforma" className="w-56 shrink-0 border-r border-border bg-white p-4">
          <ul className="flex flex-col gap-1">
            {menu.map((item) => (
              <li key={item}>
                <Link
                  href={item === "inicio" ? "/plataforma" : `/plataforma/${item}`}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-text-form hover:bg-border-light"
                >
                  {PLATAFORMA_MENU_LABELS[item]}
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
