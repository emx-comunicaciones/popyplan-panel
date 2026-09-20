import Image from "next/image";
import { useTranslations } from "next-intl";

import { StoreLinks } from "./StoreLinks";

/**
 * Banner de descarga (rediseño 2026-09-20, bloque 6 del brief): la
 * llamada final, con esquinas muy redondeadas, degradado turquesa,
 * textura y dos móviles a la derecha.
 *
 * **Contraste del titular blanco**: el degradado va de
 * `--color-primary-600` (#12908b, 3,90:1 con blanco) a
 * `--color-primary-700` (5,03:1), nunca del tono de marca a secas
 * (`--color-primary`, 2,59:1, que no llegaría ni al 3:1 de texto
 * grande). La textura va al 10 % en `mix-blend-screen`, que en el peor
 * caso (blanco puro) deja el extremo claro en ≈3,4:1 — sigue por encima
 * del umbral de texto grande, y el titular es de 30-36 px. Los dos tonos
 * están auditados en `lib/a11y/tokens.test.ts`.
 *
 * Las insignias de tienda usan la variante `onDark`: fondo de tinte
 * claro con texto oscuro, porque su texto es pequeño y no podría ir en
 * blanco sobre el degradado.
 *
 * Los dos móviles son decorativos por debajo de `lg` (no se pintan) y
 * arriba llevan uno el `alt` traducido y otro `alt=""`: describir dos
 * veces la misma pantalla de la app sería ruido.
 */
export function DownloadBanner() {
  const t = useTranslations("landing.download");

  return (
    <section id="descarga" className="relative scroll-mt-24 px-4 pb-24 pt-20 lg:px-12 lg:pt-28">
      <Image
        src="/landing/blob-2.svg"
        alt=""
        width={460}
        height={420}
        unoptimized
        className="pointer-events-none absolute -right-10 bottom-0 hidden h-[420px] w-[460px] rotate-[86deg] select-none opacity-70 lg:block"
      />
      <div className="relative mx-auto max-w-[1344px]">
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-primary-600 to-primary-700 px-6 py-12 sm:px-10 lg:px-16 lg:py-14">
          <Image
            src="/landing/banner-texture.png"
            alt=""
            width={1100}
            height={616}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-10 mix-blend-screen"
          />
          <div className="relative grid items-center gap-10 lg:grid-cols-2">
            <div className="flex flex-col gap-8">
              <h2 className="max-w-[520px] font-display text-[30px] font-bold leading-tight text-text-inverse sm:text-[36px]">
                {t("title")}
              </h2>
              <StoreLinks variant="onDark" />
            </div>
            <div className="relative hidden h-[300px] lg:block">
              <Image
                src="/landing/banner-phone-profile.png"
                alt=""
                width={372}
                height={660}
                className="absolute bottom-[-32px] right-[150px] z-0 w-[260px] drop-shadow-xl"
              />
              <Image
                src="/landing/banner-phone-match.png"
                alt={t("phoneAlt")}
                width={372}
                height={660}
                className="absolute -top-28 right-0 z-10 w-[300px] drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
