"use client";

/**
 * Botón de ayuda de la cabecera (tarea 2 de «ayuda por pantalla»):
 * un signo de interrogación junto a «Cerrar sesión» en los tres
 * layouts de área. Resuelve la pantalla actual con `usePathname()`
 * contra el registro de `lib/help/pageHelp.ts`; sin entrada para la
 * ruta (login, elegir-entidad, accesibilidad, la raíz…, decisión 3 del
 * plan) no pinta nada — esas rutas no tienen esta cabecera de todos
 * modos, pero el componente es defensivo por si se monta en otro sitio.
 *
 * Reutiliza `components/ui/Dialog.tsx` (foco atrapado, `Escape` cierra,
 * el foco vuelve al botón al cerrarse): este componente solo decide
 * cuándo mostrarlo y con qué texto, nunca duplica esa mecánica.
 *
 * Fase 1 de la ampliación: además del resumen/acciones/audiencia, el
 * diálogo pinta «Cómo funciona» (`details`), «Consejos» (`tips`) y
 * «Pantallas relacionadas» (`related`). Las tres secciones se leen con
 * `safeRaw` (un `t.raw` que devuelve `undefined` en vez de lanzar si la
 * clave aún no existe en el catálogo): así el componente sobrevive a
 * catálogos que todavía no llevan el contenido nuevo, y cada sección
 * solo se pinta cuando su valor existe y no está vacío. Cada
 * relacionada navega con `resolveRelatedRoute` (`lib/help/pageHelp.ts`):
 * las rutas estáticas directo, las de `[slug]` portando el slug del
 * pathname actual, y sin botón en cualquier otro caso (fichas u otras
 * áreas, defensivo, sin asertos).
 */
import { useEffect, useId, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { matchPageHelp, PAGE_HELP, resolveRelatedRoute } from "@/lib/help/pageHelp";

/**
 * Lee un valor opcional del catálogo de ayuda: `t.raw` no lanza con una
 * clave ausente, devuelve el *fallback* de next-intl (indistinguible de
 * un texto real), así que primero se comprueba la existencia con `t.has`
 * y el `try` cubre valores que existan pero no sean arrays/strings
 * legibles (defensivo, nunca debería pasar con la paridad de catálogos).
 */
function safeRaw(
  tHelp: { has: (key: string) => boolean; raw: (key: string) => unknown },
  key: string,
): unknown {
  if (!tHelp.has(key)) return undefined;
  try {
    return tHelp.raw(key);
  } catch {
    return undefined;
  }
}

export function PageHelp() {
  const pathname = usePathname();
  const router = useRouter();
  // Textos de UI fijos del propio componente (tarea i18n 2, sin cambios).
  const t = useTranslations("ui.pageHelp");
  // Contenido de cada pantalla (tarea i18n 5, decisión 6 del plan): las
  // 203 cadenas del registro viven ahora en `messages/*.json::help`,
  // indexadas por `entry.key` (`lib/help/pageHelp.ts`).
  const tHelp = useTranslations("help");
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const entry = matchPageHelp(pathname);

  // Cambiar de pantalla (incluida una navegación atrás/adelante del
  // navegador, que no pasa por el propio botón) cierra el diálogo: si
  // no, se queda abierto mostrando ya la ayuda de la pantalla nueva,
  // como si nunca se hubiera navegado.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!entry) return null;

  const title = tHelp(`${entry.key}.title`);
  const summary = tHelp(`${entry.key}.summary`);
  const audience = tHelp(`${entry.key}.audience`);
  // `t.raw` devuelve el array de `messages/*.json` tal cual (sin pasar
  // por el formateo ICU de `t()`, que solo entiende strings) — cada
  // elemento es ya una traducción completa, no hace falta interpolar
  // nada más.
  const actions = tHelp.raw(`${entry.key}.actions`) as string[];
  // Secciones nuevas (fase 1): leídas en crudo y filtradas para que un
  // valor ausente o vacío en el catálogo se comporte como «sin sección»,
  // no como un render roto — el contenido lo escribe otro proceso y este
  // componente no puede darlo por presente hasta entonces.
  const rawDetails = safeRaw(tHelp, `${entry.key}.details`);
  const details = typeof rawDetails === "string" ? rawDetails : "";
  const rawTips = safeRaw(tHelp, `${entry.key}.tips`);
  const tips = Array.isArray(rawTips)
    ? rawTips.filter((tip): tip is string => typeof tip === "string" && tip.length > 0)
    : [];
  const rawRelated = safeRaw(tHelp, `${entry.key}.related`);
  const related = Array.isArray(rawRelated)
    ? rawRelated.filter((key): key is string => typeof key === "string" && key.length > 0)
    : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("ariaLabel", { title })}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-sm text-primary-700 font-semibold hover:bg-primary-100 focus-visible:outline-primary-700"
      >
        <span aria-hidden="true">?</span>
      </button>
      <Dialog
        open={open}
        titleId={titleId}
        title={title}
        onClose={() => setOpen(false)}
        widthClassName="max-w-2xl"
      >
        <p>{summary}</p>
        {details.length > 0 && (
          <>
            <h3 className="mt-3 text-sm font-semibold text-text-base">{t("detailsLabel")}</h3>
            <p className="mt-1.5 text-sm text-text-base">{details}</p>
          </>
        )}
        <h3 className="mt-3 text-sm font-semibold text-text-base">{t("whatYouCanDo")}</h3>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-text-base">
          {actions.map((action, index) => (
            <li key={index}>{action}</li>
          ))}
        </ul>
        {tips.length > 0 && (
          <>
            <h3 className="mt-3 text-sm font-semibold text-text-base">{t("tipsLabel")}</h3>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-text-base">
              {tips.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          </>
        )}
        {related.length > 0 && (
          <>
            <h3 className="mt-3 text-sm font-semibold text-text-base">{t("relatedLabel")}</h3>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {related.map((relatedKey) => {
                const relatedEntry = PAGE_HELP.find((candidate) => candidate.key === relatedKey);
                if (!relatedEntry) return null;
                const route = resolveRelatedRoute(pathname, entry, relatedEntry);
                // Sin ruta resoluble (ficha de otra área, slug no
                // portable): no se pinta el botón, nunca se navega a una
                // ruta a medias.
                if (!route) return null;
                return (
                  <Button
                    key={relatedKey}
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setOpen(false);
                      router.push(route);
                    }}
                  >
                    {tHelp(`${relatedKey}.title`)}
                  </Button>
                );
              })}
            </div>
          </>
        )}
        <p className="mt-3 text-sm text-text-secondary">
          <strong>{t("audienceLabel")}</strong> {audience}
        </p>
      </Dialog>
    </>
  );
}
