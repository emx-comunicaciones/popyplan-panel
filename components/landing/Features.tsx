import Image from "next/image";
import { useTranslations } from "next-intl";

/**
 * «Funcionalidades» (rediseño 2026-09-20, bloque 4 del brief): tres
 * columnas con icono redondo turquesa, titular y una línea de
 * explicación.
 *
 * Las tres entradas se enumeran en un array **literal** (`FEATURES`), no
 * con claves construidas por concatenación libre: es el mapa explícito
 * que permite la convención de i18n de este repo («nunca claves
 * dinámicas salvo un mapa con todas las variantes»).
 *
 * El círculo del icono va en degradado de `--color-primary` a
 * `--color-primary-700`: el glifo blanco queda sobre un turquesa medio
 * (≈3,4:1), por encima del 3:1 que pide el criterio de contraste de
 * elementos gráficos, en vez del tono de marca a secas (2,59:1). Los
 * iconos son además decorativos (`alt=""`): el titular de al lado dice
 * lo mismo.
 */
const FEATURES = [
  { key: "communities", icon: "/landing/ic-community.svg" },
  { key: "plans", icon: "/landing/ic-browser.svg" },
  { key: "share", icon: "/landing/ic-chat.svg" },
] as const;

const TITLE_KEYS = {
  communities: "communitiesTitle",
  plans: "plansTitle",
  share: "shareTitle",
} as const;

const BODY_KEYS = {
  communities: "communitiesBody",
  plans: "plansBody",
  share: "shareBody",
} as const;

export function Features() {
  const t = useTranslations("landing.features");

  return (
    <section id="funcionalidades" className="relative scroll-mt-24 pt-16 lg:pt-24">
      <div className="mx-auto w-full max-w-[1440px] px-4 lg:px-12">
        <h2 className="mb-10 text-center font-display text-[24px] font-bold text-text-base sm:text-[32px]">
          {t("title")}
        </h2>
        <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-16">
          {FEATURES.map(({ key, icon }) => (
            <div key={key} className="flex max-w-[360px] flex-col gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-700">
                <Image src={icon} alt="" width={32} height={32} unoptimized className="h-8 w-8" />
              </div>
              <div className="flex flex-col gap-2 text-text-base">
                <h3 className="font-display text-[20px] font-bold leading-tight">
                  {t(TITLE_KEYS[key])}
                </h3>
                <p className="text-[17px] leading-snug">{t(BODY_KEYS[key])}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
