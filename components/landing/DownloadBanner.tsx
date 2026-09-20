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
 * **Los dos móviles son pantallas de comunidades**, no de
 * emparejamiento (encargo del propietario, «no hay match en esta
 * versión»): `banner-phone-match.png` («¡Es un match!») y
 * `banner-phone-profile.png` (una ficha con botones de me gusta / no me
 * gusta y «busco conexiones auténticas») enseñaban una función que este
 * producto no tiene, así que los dos ficheros se borraron del repo para
 * que no puedan volver por descuido. En su lugar van los mockups de
 * comunidad que ya usa el conmutador, al mismo tamaño.
 *
 * Solo se pintan desde `lg`; arriba lleva uno el `alt` traducido y otro
 * `alt=""`: describir dos veces la misma pantalla de la app sería ruido.
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
        <div className="relative rounded-[32px] px-6 py-12 sm:px-10 lg:px-16 lg:py-14">
          {/*
            El fondo (degradado + textura) va en su propia capa con
            `overflow-hidden`, y no en la tarjeta: así la textura queda
            recortada por las esquinas redondeadas mientras los dos
            móviles siguen pudiendo sobresalir por arriba, como en la web
            de referencia.
          */}
          <div className="absolute inset-0 overflow-hidden rounded-[32px]">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-primary-700" />
            <Image
              src="/landing/banner-texture.png"
              alt=""
              width={1100}
              height={616}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-10 mix-blend-screen"
            />
          </div>
          <div className="relative grid items-center gap-10 lg:grid-cols-2">
            <div className="flex flex-col gap-8">
              <h2 className="max-w-[520px] font-display text-[30px] font-bold leading-tight text-text-inverse sm:text-[36px]">
                {t("title")}
              </h2>
              <StoreLinks variant="onDark" />
            </div>
            <div className="relative hidden h-[300px] lg:block">
              <Image
                src="/landing/circle-mockup-left.png"
                alt=""
                width={880}
                height={1561}
                className="absolute bottom-[-24px] right-[150px] z-0 w-[190px] drop-shadow-xl"
              />
              <Image
                src="/landing/circle-mockup-right.png"
                alt={t("phoneAlt")}
                width={880}
                height={1561}
                className="absolute -top-16 right-0 z-10 w-[220px] drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
