"use client";

/**
 * Menú lateral de las tres áreas (`app/{entidad,paraguas,plataforma}/**\/
 * layout.tsx`). Extraído a un componente propio en la pasada de densidad
 * (2026-09-20): las tres copias del `<nav>` eran idénticas salvo las
 * rutas, y marcar la sección actual necesita `usePathname()`, que un
 * Server Component no puede llamar. Las etiquetas llegan ya traducidas
 * desde cada layout (que sí tiene `getTranslations`), así que este
 * componente no traduce nada — solo pinta.
 *
 * Medidas: 200px de ancho, filas de 30px con texto de 13px (`text-sm`,
 * ver la escala de `app/globals.css`).
 *
 * Sección activa: la de `href` más largo que case con el `pathname`
 * actual (exacto o como prefijo de segmento). Comparar solo por prefijo
 * marcaría «Inicio» —cuyo `href` es la raíz del área— en todas las
 * pantallas; el desempate por longitud lo resuelve sin necesidad de una
 * bandera `exact` por elemento. Se marca con `aria-current="page"` y con
 * un fondo tenue **más** `font-semibold`: nunca solo con color, y el par
 * `text-base`/`primary-100` es uno de los ya auditados en
 * `lib/a11y/tokens.test.ts` (16,93:1).
 *
 * Tableta y móvil (informe del panel, error 39): por debajo de `md`
 * (768px) el menú se pliega y un botón flotante lo abre como cajón sobre
 * el contenido (se cierra al elegir una sección, con el fondo o con el
 * botón). Desde `md` es la columna fija de siempre.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export interface SideNavItem {
  href: string;
  label: string;
}

export interface SideNavProps {
  ariaLabel: string;
  items: SideNavItem[];
}

export function SideNav({ ariaLabel, items }: SideNavProps) {
  const pathname = usePathname();
  const activeHref =
    items
      .map((item) => item.href)
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length)[0] ?? null;

  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  // Al navegar a otra sección el cajón se cierra.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? t("menuClose") : t("menuOpen")}
        className="fixed bottom-4 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-primary-700 text-lg text-text-inverse shadow-lg md:hidden"
      >
        <span aria-hidden="true">{open ? "×" : "☰"}</span>
      </button>
      {open ? (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      ) : null}
      <nav
        aria-label={ariaLabel}
        className={`${
          open
            ? "fixed inset-y-0 left-0 z-40 block w-64 overflow-y-auto shadow-lg"
            : "hidden"
        } border-r border-border bg-white p-2 md:static md:z-auto md:block md:w-50 md:shrink-0 md:overflow-visible md:shadow-none`}
      >
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const isActive = item.href === activeHref;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`block rounded-md px-2.5 py-1.5 text-sm ${
                    isActive
                      ? "bg-primary-100 font-semibold text-text-base"
                      : "font-medium text-text-form hover:bg-border-light"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
