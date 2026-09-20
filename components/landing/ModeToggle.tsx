"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";

type Mode = "plans" | "communities";

/**
 * Conmutador «Planes / Comunidades» (rediseño 2026-09-20, bloque 3 del
 * brief), equivalente al «POP Circle / POP Date» de la web de
 * referencia: dos pastillas que cambian la frase de debajo, los mockups
 * de la app y un titular fijo.
 *
 * **El único componente con estado de toda la landing** (`"use client"`);
 * el resto son Server Components síncronos. Por eso el conmutador vive
 * en su propio fichero: así el JavaScript del cliente se limita a estas
 * dos pastillas.
 *
 * Dos botones con `aria-pressed`, **no** un patrón de pestañas ARIA
 * (`role="tablist"`): no hay paneles que mostrar y ocultar, solo un
 * texto que cambia — anunciar pestañas obligaría además a implementar la
 * navegación por flechas que ese patrón exige. Es el mismo criterio que
 * ya siguen los selectores de botones del panel
 * (`EntidadDetail`/`ContratosPanel`, ver CLAUDE.md).
 *
 * La frase que cambia va en una región `aria-live="polite"` **siempre
 * montada** (solo cambia su texto): quien no ve la pantalla oye el
 * cambio al pulsar una pastilla, que si no sería un botón que
 * aparentemente no hace nada.
 */
export function ModeToggle() {
  const t = useTranslations("landing.modes");
  const [mode, setMode] = useState<Mode>("plans");

  // La pastilla inactiva **no cambia de color al pasar el ratón**, se
  // subraya (M2 de la revisión de rama): `text-primary-700` sobre el
  // `primary-100` del contenedor da 4,31:1, por debajo de AA para un texto
  // de 18-20 px con peso normal — es decir, el `hover` empeoraba un texto
  // que en reposo está en 16,93:1. El subrayado no depende del color ni
  // mueve el contenido (a diferencia de cambiar el peso de la letra).
  const pill = (active: boolean) =>
    `cursor-pointer rounded-full px-6 py-3 text-[18px] leading-tight transition-colors sm:px-8 sm:text-[20px] ${
      active
        ? "bg-primary-700 font-semibold text-text-inverse"
        : "font-normal text-text-base underline-offset-4 hover:underline"
    }`;

  return (
    <section className="relative pt-16 lg:pt-24">
      <div className="flex flex-col gap-10 lg:gap-14">
        <div className="flex justify-center px-4">
          <div
            role="group"
            aria-label={t("label")}
            className="inline-flex items-center gap-2 rounded-full bg-primary-100 p-2"
          >
            <button
              type="button"
              aria-pressed={mode === "plans"}
              onClick={() => setMode("plans")}
              className={pill(mode === "plans")}
            >
              {t("plans")}
            </button>
            <button
              type="button"
              aria-pressed={mode === "communities"}
              onClick={() => setMode("communities")}
              className={pill(mode === "communities")}
            >
              {t("communities")}
            </button>
          </div>
        </div>

        <p
          aria-live="polite"
          className="mx-auto max-w-[680px] px-4 text-center text-[18px] text-text-base sm:text-[20px]"
        >
          {mode === "plans" ? t("plansText") : t("communitiesText")}
        </p>

        <div className="relative mx-auto w-full max-w-[1440px] overflow-hidden px-4 lg:px-12">
          <Image
            src="/landing/blob-3.svg"
            alt=""
            width={640}
            height={620}
            unoptimized
            className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[620px] w-[640px] -translate-x-1/2 -translate-y-1/2 rotate-90 select-none opacity-70 md:block"
          />
          <Image
            src="/landing/bubble-b.svg"
            alt=""
            width={240}
            height={240}
            unoptimized
            className="pointer-events-none absolute -left-8 top-4 hidden h-[240px] w-[240px] select-none lg:block"
          />
          <Image
            src="/landing/bubble-c.svg"
            alt=""
            width={200}
            height={200}
            unoptimized
            className="pointer-events-none absolute -right-4 bottom-10 hidden h-[200px] w-[200px] select-none lg:block"
          />
          <Image
            src="/landing/bubble-a.svg"
            alt=""
            width={170}
            height={170}
            unoptimized
            className="pointer-events-none absolute left-[18%] top-[60%] hidden h-[170px] w-[170px] select-none lg:block"
          />
          <div className="relative flex items-end justify-center">
            <Image
              src="/landing/circle-mockup-left.png"
              alt=""
              width={880}
              height={1561}
              className="z-0 hidden w-[180px] translate-y-8 sm:block md:w-[230px] lg:w-[280px] lg:translate-y-12"
            />
            <Image
              src="/landing/circle-hero.png"
              alt={t("mockupAlt")}
              width={880}
              height={1561}
              className="relative z-10 -mx-8 w-[210px] sm:-mx-10 sm:w-[230px] md:-mx-16 md:w-[300px] lg:-mx-24 lg:w-[360px]"
            />
            <Image
              src="/landing/circle-mockup-right.png"
              alt=""
              width={880}
              height={1561}
              className="z-0 hidden w-[180px] translate-y-8 sm:block md:w-[230px] lg:w-[280px] lg:translate-y-12"
            />
          </div>
        </div>

        <h2 className="mx-auto max-w-[760px] px-4 text-center font-display text-[24px] font-bold leading-tight text-text-base sm:text-[32px]">
          {t("heading")}
        </h2>
      </div>
    </section>
  );
}
