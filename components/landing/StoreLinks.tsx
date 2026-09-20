import { useTranslations } from "next-intl";

import { storeLinks } from "@/lib/config/site";

import { SECONDARY_LINK_CLASS } from "./linkStyles";

export interface StoreLinksProps {
  /**
   * Etiqueta opcional encima de los botones («Descarga la app»). Cuando
   * no hay ninguna tienda configurada **tampoco se pinta la etiqueta**:
   * un rótulo suelto sin botones debajo se lee como algo que falta.
   */
  label?: string;
}

/**
 * Botones de tienda de la web pública (spec de diseño
 * `2026-09-20-landing-login-unico-design.md` §3.3). Solo se pinta la
 * tienda cuya URL está configurada (`NEXT_PUBLIC_APP_STORE_URL` /
 * `NEXT_PUBLIC_PLAY_STORE_URL`, `lib/config/site.ts`); sin ninguna de las
 * dos, el componente entero devuelve `null` — enlazar a una ficha que
 * todavía no existe es peor que no ofrecer el botón.
 *
 * Server Component **síncrono** con `useTranslations` (ver el gotcha de
 * la Tarea 3 del plan): un componente `async` dentro del árbol de
 * `app/page.tsx` no lo puede renderizar Testing Library.
 */
export function StoreLinks({ label }: StoreLinksProps = {}) {
  const { appStore, playStore } = storeLinks();
  const t = useTranslations("landing.stores");

  if (!appStore && !playStore) return null;

  return (
    <div className="flex flex-col gap-2">
      {label ? <p className="text-sm font-medium text-text-form">{label}</p> : null}
      <div className="flex flex-wrap gap-2">
        {appStore ? (
          <a href={appStore} className={SECONDARY_LINK_CLASS}>
            {t("appStore")}
          </a>
        ) : null}
        {playStore ? (
          <a href={playStore} className={SECONDARY_LINK_CLASS}>
            {t("playStore")}
          </a>
        ) : null}
      </div>
    </div>
  );
}
