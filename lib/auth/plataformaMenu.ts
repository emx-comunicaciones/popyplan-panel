/**
 * Menú lateral del panel de plataforma (decisión «Panel de plataforma»,
 * plan de Fase 5). W1 lo dejó igual para los cuatro roles de
 * `safety.PlatformRole` (`superadmin`, `verifier`, `moderator`,
 * `support`), a la espera de que las páginas reales (P5-P7 backend, W5
 * panel) decidieran qué puede *usar* cada uno.
 *
 * Tarea W5: matriz real, sacada del permiso de cada endpoint
 * (`docs/SEGURIDAD_Y_MODERACION.md` y `docs/PANEL.md`):
 * - **`superadmin`**: todo.
 * - **`verifier`**: Inicio, Entidades (alta/verificar) y Verificaciones
 *   (`organization-list/create/verify` y
 *   `verification-review-queue/decide` piden
 *   `HasPlatformRole('verifier', 'superadmin')`); nunca Reportes/Ayuda
 *   (`safety/services/reports.py::queue` exige
 *   `moderator`/`superadmin`/`support`, sin `verifier`), nunca Métricas
 *   (`PlataformaMetricsView` exige `superadmin`/`moderator`/`support`,
 *   sin `verifier` — pregunta 7 del informe de W2, ya detectada) ni
 *   Roles/Auditoría (solo `superadmin`).
 * - **`moderator`**: Inicio, Reportes, Ayuda y Métricas (mismo permiso
 *   que arriba); nunca Entidades/Verificaciones (solo
 *   `verifier`/`superadmin`) ni Roles/Auditoría (solo `superadmin`).
 * - **`support`**: Inicio, Reportes y Ayuda, pero solo lectura (`safety/
 *   services/reports.py::can_view` lo admite en la cola/detalle, `can_act`
 *   no: sin asignar/resolver/escalar; en Ayuda no es guardia de ninguna
 *   entidad salvo que también tenga membresía, así que la lista casi
 *   siempre queda vacía — el permiso de la página no depende de eso).
 *   También Métricas (mismo permiso que `moderator`). Nunca
 *   Entidades/Verificaciones/Roles/Auditoría.
 */
export const PLATAFORMA_MENU_ITEMS = [
  "inicio",
  "entidades",
  "reportes",
  "ayuda",
  "verificaciones",
  "roles",
  "auditoria",
  "metricas",
] as const;

export type PlataformaMenuItem = (typeof PLATAFORMA_MENU_ITEMS)[number];

export const PLATAFORMA_MENU_LABELS: Record<PlataformaMenuItem, string> = {
  inicio: "Inicio",
  entidades: "Entidades",
  reportes: "Reportes",
  ayuda: "Ayuda",
  verificaciones: "Verificaciones",
  roles: "Roles",
  auditoria: "Auditoría",
  metricas: "Métricas",
};

const VERIFIER_VISIBLE: readonly PlataformaMenuItem[] = ["inicio", "entidades", "verificaciones"];
const MODERATOR_VISIBLE: readonly PlataformaMenuItem[] = ["inicio", "reportes", "ayuda", "metricas"];
const SUPPORT_VISIBLE: readonly PlataformaMenuItem[] = ["inicio", "reportes", "ayuda", "metricas"];

export function plataformaMenuFor(role: string | null | undefined): PlataformaMenuItem[] {
  switch (role) {
    case "superadmin":
      return [...PLATAFORMA_MENU_ITEMS];
    case "verifier":
      return [...VERIFIER_VISIBLE];
    case "moderator":
      return [...MODERATOR_VISIBLE];
    case "support":
      return [...SUPPORT_VISIBLE];
    default:
      return [];
  }
}
