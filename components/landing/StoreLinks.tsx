import Image from "next/image";
import { useTranslations } from "next-intl";

import { storeLinks } from "@/lib/config/site";

export type StoreLinksVariant = "light" | "onDark";

export interface StoreLinksProps {
  /**
   * Etiqueta opcional encima de los botones («Descarga la app»). Cuando
   * no hay ninguna tienda configurada **tampoco se pinta la etiqueta**:
   * un rótulo suelto sin botones debajo se lee como algo que falta.
   */
  label?: string;
  /**
   * `light` (por defecto) sobre fondos claros: insignia blanca con
   * borde. `onDark` sobre el degradado turquesa del banner de descarga:
   * el mismo borde y el mismo texto oscuro, con el tinte de marca de
   * fondo — nunca texto claro sobre el degradado, que no llegaría al
   * contraste de texto pequeño.
   */
  variant?: StoreLinksVariant;
}

const BADGE_BASE =
  "group flex shrink-0 items-center gap-3 rounded-lg border border-text-base px-4 py-2 transition-colors";

const BADGE_VARIANT: Record<StoreLinksVariant, string> = {
  light: "bg-white hover:bg-primary-100",
  // `focus-visible:outline-text-inverse` (I1 de la revisión de rama): el
  // anillo de foco global (`--color-primary-700`) se dibuja **fuera** de
  // la insignia, sobre el degradado turquesa del banner, donde queda en
  // 1,29:1; en blanco son 3,90:1 contra el extremo claro del degradado y
  // 5,03:1 contra el oscuro.
  onDark: "bg-primary-100 hover:bg-white focus-visible:outline-text-inverse",
};

/**
 * Insignias de tienda de la web pública, con el aspecto de la web de
 * referencia (icono + «Descárgalo en» / «App Store» en dos líneas).
 *
 * Las URL salen de `lib/config/site.ts::storeLinks()`: sin variables de
 * entorno son las fichas **reales** ya publicadas; una variable con un
 * valor que no sea `https:` devuelve `null` y esa insignia no se pinta
 * (con las dos a `null`, el componente entero devuelve `null` — un
 * rótulo «Descarga la app» sin nada debajo se lee como un fallo).
 *
 * El nombre accesible de cada insignia lo fija un `aria-label` propio, no
 * la suma de sus dos líneas de texto: «Descárgalo en» y «App Store» son
 * dos nodos pegados, sin espacio entre ellos, y cada navegador decide por
 * su cuenta si mete uno al calcular el nombre (jsdom no lo hace, Chrome
 * sí) — con el `aria-label` el nombre es el mismo en el navegador, en los
 * tests y en Playwright. **Su valor es exactamente el texto visible
 * concatenado** («Descárgalo en App Store»), nunca una redacción propia
 * (I2 de la revisión de rama): WCAG 2.5.3 «Label in Name» (nivel A) exige
 * que lo que se ve esté contenido en el nombre accesible, o quien usa
 * control por voz dice lo que lee y el comando no encuentra el enlace. Los dos iconos
 * son SVG decorativos (`alt=""`) y van con `unoptimized`
 * porque el optimizador de imágenes de Next rechaza los SVG salvo con
 * `dangerouslyAllowSVG`, que no se activa por un icono.
 *
 * `target="_blank"` + `rel="noopener noreferrer"`: son enlaces a un
 * dominio externo (Apple/Google), no a una ruta del panel.
 *
 * Server Component **síncrono** con `useTranslations`: un componente
 * `async` dentro del árbol de `app/page.tsx` no lo puede renderizar
 * Testing Library.
 */
export function StoreLinks({ label, variant = "light" }: StoreLinksProps = {}) {
  const { appStore, playStore } = storeLinks();
  const t = useTranslations("landing.stores");

  if (!appStore && !playStore) return null;

  const badgeClass = `${BADGE_BASE} ${BADGE_VARIANT[variant]}`;
  const playStoreIcon = variant === "onDark" ? "/landing/playstore-color.svg" : "/landing/playstore.svg";

  return (
    <div className="flex flex-col gap-2">
      {label ? <p className="text-[14px] font-medium text-text-base">{label}</p> : null}
      <div className="flex flex-wrap items-center gap-4">
        {appStore ? (
          <a
            href={appStore}
            aria-label={t("appStoreLabel")}
            target="_blank"
            rel="noopener noreferrer"
            className={badgeClass}
          >
            <Image src="/landing/apple.svg" alt="" width={24} height={29} unoptimized />
            <span className="flex flex-col text-left leading-tight text-text-base">
              <span className="text-[14px]">{t("appStorePrefix")}</span>
              <span className="font-display text-[18px] font-bold">{t("appStoreName")}</span>
            </span>
          </a>
        ) : null}
        {playStore ? (
          <a
            href={playStore}
            aria-label={t("playStoreLabel")}
            target="_blank"
            rel="noopener noreferrer"
            className={badgeClass}
          >
            <Image src={playStoreIcon} alt="" width={24} height={27} unoptimized />
            <span className="flex flex-col text-left leading-tight text-text-base">
              <span className="text-[14px]">{t("playStorePrefix")}</span>
              <span className="font-display text-[18px] font-bold">{t("playStoreName")}</span>
            </span>
          </a>
        ) : null}
      </div>
    </div>
  );
}
