"use client";

/**
 * Armazón de la pestaña «Comercial»: barra de secciones del CRM, búsqueda
 * global (punto 44), avisos (punto 45) y el botón permanente
 * «+ Registrar actividad» (puntos 36-37), presente en todas las pantallas.
 *
 * `CrmContext` deja a cualquier pantalla abrir el registro rápido con la
 * entidad (y la oportunidad) ya elegidas: la ficha de una entidad, una
 * tarjeta del pipeline o una tarea.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";

import { CrmGlobalSearch } from "./CrmGlobalSearch";
import { CrmNotificationsMenu } from "./CrmNotificationsMenu";
import { QuickActivityDialog, type QuickActivityPreset } from "./QuickActivityDialog";

interface CrmContextValue {
  isManager: boolean;
  userId: number;
  openActivity: (preset?: QuickActivityPreset) => void;
}

const CrmContext = createContext<CrmContextValue | null>(null);

/** Fuera de la pestaña (tests de un componente suelto) devuelve un valor neutro. */
export function useCrmContext(): CrmContextValue {
  return (
    useContext(CrmContext) ?? { isManager: false, userId: 0, openActivity: () => undefined }
  );
}

export function CrmProvider({
  isManager,
  userId,
  children,
}: {
  isManager: boolean;
  userId: number;
  children: ReactNode;
}) {
  const [preset, setPreset] = useState<QuickActivityPreset | null>(null);
  const openActivity = useCallback((value?: QuickActivityPreset) => setPreset(value ?? {}), []);
  const value = useMemo(() => ({ isManager, userId, openActivity }), [isManager, userId, openActivity]);
  return (
    <CrmContext.Provider value={value}>
      {children}
      {preset ? (
        <QuickActivityDialog preset={preset} userId={userId} isManager={isManager} onClose={() => setPreset(null)} />
      ) : null}
    </CrmContext.Provider>
  );
}

export interface CrmShellProps {
  sections: { href: string; label: string }[];
  isManager: boolean;
  userId: number;
  children: ReactNode;
}

export function CrmShell({ sections, isManager, userId, children }: CrmShellProps) {
  const t = useTranslations("crm.shell");
  const pathname = usePathname();
  const activeHref =
    sections
      .map((s) => s.href)
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length)[0] ?? null;

  return (
    <CrmProvider isManager={isManager} userId={userId}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CrmGlobalSearch />
          <div className="ml-auto flex items-center gap-2">
            <CrmNotificationsMenu />
            <QuickActivityButton label={t("registerActivity")} />
          </div>
        </div>
        <nav aria-label={t("navLabel")} className="-mx-1 overflow-x-auto">
          <ul className="flex min-w-max gap-1 border-b border-border px-1">
            {sections.map((section) => {
              const active = section.href === activeHref;
              return (
                <li key={section.href}>
                  <Link
                    href={section.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-t-md px-2.5 py-1.5 text-sm ${
                      active
                        ? "border-b-2 border-primary-700 bg-primary-100 font-semibold text-text-base"
                        : "font-medium text-text-form hover:bg-border-light"
                    }`}
                  >
                    {section.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div>{children}</div>
      </div>
    </CrmProvider>
  );
}

function QuickActivityButton({ label }: { label: string }) {
  const { openActivity } = useCrmContext();
  return (
    <Button type="button" onClick={() => openActivity()}>
      {label}
    </Button>
  );
}
