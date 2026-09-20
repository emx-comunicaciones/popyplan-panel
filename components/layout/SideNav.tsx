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
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

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

  return (
    <nav aria-label={ariaLabel} className="w-50 shrink-0 border-r border-border bg-white p-2">
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
  );
}
