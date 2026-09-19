/**
 * Texto a mostrar para un error de hook con `kind` (patrón fijado en la
 * tarea 3 de i18n, `CLAUDE.md`): los hooks de datos son `.ts` planos —
 * no pueden llamar a `useTranslations`, un hook de React — así que
 * siguen construyendo su `Error` con `kind` (y, cuando lo hay,
 * `detailOf(error)` del backend) tal cual lo hacían antes; es el
 * componente, que sí tiene `t()`, quien decide qué texto pintar.
 *
 * Prioridad: el texto verbatim del backend (`error.detail`, solo
 * presente cuando `detailOf` encontró algo) manda siempre — nunca se
 * traduce ni se sustituye. Si no hay `detail`, se traduce por `kind` con
 * el mapa que pasa cada componente (`Record<Kind, string>` de claves,
 * nunca una clave construida por concatenación). Un error sin `kind`
 * reconocido (un mock de test que solo pone `.message`, o un `kind` que
 * el mapa no cubre) cae al `fallbackKey` del propio error (normalmente
 * la clave «desconocido» de ese mismo hook).
 */
export interface KindError<Kind extends string> {
  kind?: Kind;
  detail?: string;
}

export function errorKindText<Kind extends string>(
  error: KindError<Kind> | null | undefined,
  keys: Record<Kind, string>,
  t: (key: string) => string,
  fallbackKey: string,
): string {
  if (!error) return t(fallbackKey);
  if (error.detail) return error.detail;
  const key = error.kind ? keys[error.kind] : undefined;
  return t(key ?? fallbackKey);
}
