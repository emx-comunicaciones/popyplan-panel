import Image from "next/image";
import { useTranslations } from "next-intl";

import { StoreLinks } from "./StoreLinks";

/**
 * Portada de la web pública (rediseño 2026-09-20, bloque 2 del brief):
 * titular, subtítulo, insignias de tienda y el mockup de la app con tres
 * tarjetas de foto flotantes, como en la web de referencia.
 *
 * Fondo: degradado de blanco al tono de marca (`--color-primary`) con la
 * textura encima en `mix-blend-lighten`, que solo puede **aclarar** el
 * fondo. El texto es negro (`--color-text-base`): sobre el extremo más
 * oscuro posible del degradado (el turquesa puro) da 7,6:1, así que el
 * titular y el subtítulo son legibles en cualquier punto — y la textura,
 * al aclarar, solo puede mejorarlo.
 *
 * Las tres tarjetas de foto son decorativas (`alt=""`): no aportan
 * información que no esté en el texto, y describirlas una a una sería
 * ruido para quien navega con lector de pantalla. El mockup central sí
 * lleva `alt` traducido: es lo que enseña de qué va la app.
 *
 * Las tarjetas y el mockup se ocultan por debajo de `lg`/`md`: en móvil
 * la columna de texto ocupa el ancho entero y las fotos flotantes no
 * caben sin provocar scroll horizontal.
 */
export function Hero() {
  const t = useTranslations("landing.hero");

  return (
    <section
      id="inicio"
      className="relative scroll-mt-24 overflow-hidden bg-gradient-to-b from-white to-primary"
    >
      <Image
        src="/landing/hero-texture.jpg"
        alt=""
        width={1300}
        height={770}
        priority
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-lighten"
      />
      <div className="relative mx-auto grid w-full max-w-[1440px] items-center gap-10 px-4 pb-16 pt-12 md:grid-cols-[1fr_minmax(280px,420px)] lg:px-12 lg:pb-24 lg:pt-20">
        <div className="flex max-w-[760px] flex-col gap-7">
          <div className="flex flex-col gap-4">
            <h1 className="font-display text-[36px] font-bold leading-[1.08] text-text-base sm:text-[44px] lg:text-[56px]">
              {t("title")}
            </h1>
            <p className="max-w-[540px] text-[18px] leading-snug text-text-base sm:text-[22px]">
              {t("subtitle")}
            </p>
          </div>
          <StoreLinks />
        </div>

        <div className="relative hidden justify-center md:flex md:justify-end">
          <div className="relative w-[260px] lg:w-[340px]">
            <Image
              src="/landing/circle-hero.png"
              alt={t("mockupAlt")}
              width={880}
              height={1561}
              priority
              className="relative z-10 w-full drop-shadow-2xl"
            />
            <Image
              src="/landing/hero-card-couple.jpg"
              alt=""
              width={240}
              height={360}
              className="absolute left-[68%] top-[1%] z-20 hidden w-[31%] rounded-2xl object-cover shadow-xl lg:block"
            />
            <Image
              src="/landing/hero-card-group-left.jpg"
              alt=""
              width={240}
              height={360}
              className="absolute left-[-19%] top-[48%] z-20 hidden w-[40%] rounded-2xl object-cover shadow-xl lg:block"
            />
            <Image
              src="/landing/hero-card-group-br.jpg"
              alt=""
              width={360}
              height={235}
              className="absolute left-[74%] top-[71%] z-20 hidden w-[33%] rounded-2xl object-cover shadow-xl lg:block"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
