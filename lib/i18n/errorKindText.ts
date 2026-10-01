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

/**
 * Mensajes de validación de DRF/Django que hablan de la implementación
 * (claves primarias, tipos, restricciones de base de datos) y no le dicen
 * nada a quien rellena el formulario (informe del panel, error 41). Se
 * descartan a favor del texto por `kind`, que sí está redactado para
 * personas. Los mensajes de negocio del backend ya vienen escritos para
 * personas y no coinciden con estos patrones.
 */
const TECHNICAL_DETAIL = new RegExp(
  [
    "invalid pk",
    "clave primaria",
    "does not exist",
    "incorrect type",
    "tipo incorrecto",
    "invalid hyperlink",
    "valid integer",
    "número entero válido",
    "may not be null",
    "integrityerror",
    "duplicate entry",
    "traceback",
    "objectdoesnotexist",
  ].join("|"),
  "i",
);

/**
 * Un código interno (`sin_territorio`, `not_authenticated`,
 * `entities.organization_not_found`): una sola palabra en minúsculas unida
 * por `_`, `.` o `:`, sin espacios. No es prosa y no se le pinta a nadie
 * (informe del panel, error 13: «mensajes de error en código»).
 */
const CODE_LIKE_DETAIL = /^[a-z][a-z0-9]*(?:[_.:][a-z0-9]+)+$/;

export function isTechnicalDetail(detail: string): boolean {
  const trimmed = detail.trim();
  return TECHNICAL_DETAIL.test(trimmed) || CODE_LIKE_DETAIL.test(trimmed);
}

export function errorKindText<Kind extends string>(
  error: KindError<Kind> | null | undefined,
  keys: Record<Kind, string>,
  t: (key: string) => string,
  fallbackKey: string,
): string {
  if (!error) return t(fallbackKey);
  if (error.detail && !isTechnicalDetail(error.detail)) return error.detail;
  const key = error.kind ? keys[error.kind] : undefined;
  return t(key ?? fallbackKey);
}
