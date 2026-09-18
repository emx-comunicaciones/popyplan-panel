import {
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type Download,
  type Response,
} from "@playwright/test";

/**
 * Utilidades de fixture para los flujos e2e (tarea W6): llaman al
 * backend real directamente (no a través del panel bajo prueba) para
 * preparar datos que el propio contrato no deja provocar desde la UI —
 * p. ej. el check-in por QR solo se puede probar de verdad con una
 * actividad cuya ventana (`starts_at - 2h` a `starts_at + 12h`,
 * `docs/PANEL.md` §4.1) esté abierta *ahora mismo*, y la demo sembrada
 * (`seed_panel_demo`) tiene fechas relativas al momento en que se
 * sembró, no al momento en que corren los tests — con el tiempo, la
 * ventana de sus actividades pasadas/futuras se cierra. Se crea una
 * actividad nueva con `starts_at` a un par de minutos vista (ventana ya
 * abierta al crearla, porque abre 2h *antes* del inicio) y se borra al
 * terminar el test.
 */
export const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";
export const DEMO_PASSWORD = "panel-pass-1234";

export const BIDASOA_SLUG = "asociacion-bidasoa";
export const TITULAR_BIDASOA_EMAIL = `panel-titular-${BIDASOA_SLUG}@test.com`;
export const ANALISTA_GFA_EMAIL = "panel-analista-gfa@test.com";
export const PLATAFORMA_SUPERADMIN_EMAIL = "plataforma@test.com";
/** Una de las 20 personas «de calle» sembradas para Bidasoa (`p01`-`p20`). */
export const DEMO_PERSON_EMAIL = `panel-demo-${BIDASOA_SLUG}-p01@test.com`;
/** Segunda persona de calle, registrada en la misma actividad de fixture
 *  para marcarla asistida a mano desde la UI (distinta de la que hace
 *  check-in por QR, para no mezclar las dos acciones sobre la misma fila). */
export const DEMO_PERSON_2_EMAIL = `panel-demo-${BIDASOA_SLUG}-p02@test.com`;

export async function newApiContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL: BACKEND_URL });
}

function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/** `GET /api/users/users/me/` → id de la entidad con ese `slug` en `org_memberships`. */
export async function resolveOrgId(
  api: APIRequestContext,
  token: string,
  slug: string,
): Promise<number> {
  const response = await api.get("/api/users/users/me/", { headers: authHeader(token) });
  if (!response.ok()) {
    throw new Error(`no se pudo resolver el id de la entidad «${slug}»: ${response.status()}`);
  }
  const me = (await response.json()) as {
    org_memberships: Array<{ organization_id: number; organization_slug: string }>;
  };
  const membership = me.org_memberships.find((m) => m.organization_slug === slug);
  if (!membership) {
    throw new Error(`la cuenta no tiene membresía en la entidad «${slug}»`);
  }
  return membership.organization_id;
}

/** `POST /api/auth/login/` → access token (`key`). Lanza si falla. */
export async function apiLogin(
  api: APIRequestContext,
  usernameOrEmail: string,
  password: string = DEMO_PASSWORD,
): Promise<string> {
  const response = await api.post("/api/auth/login/", {
    data: { username_or_email: usernameOrEmail, password },
  });
  if (!response.ok()) {
    throw new Error(
      `login falló para ${usernameOrEmail}: ${response.status()} ${await response.text()}`,
    );
  }
  const body = (await response.json()) as { key: string };
  return body.key;
}

export interface CheckinFixture {
  eventId: string;
  eventTitle: string;
  /** ISO 8601. `mark_attendance` exige que la actividad ya haya
   *  empezado — quien use esta fixture para «Marcar asistió» debe
   *  esperar hasta (al menos) este instante antes de intentarlo. */
  startsAt: string;
  /** Token de check-in (`GET .../my-checkin/`) de la persona ya inscrita. */
  token: string;
  /** Nombre visible de la segunda persona inscrita (para «Marcar asistió»). */
  secondPersonName: string;
  /** Borra la actividad de prueba (organizador = titular). */
  cleanup(): Promise<void>;
}

/**
 * Crea una actividad de Bidasoa que empieza dentro de 2 minutos (válida
 * porque `EventCreateSerializer.validate_starts_at` exige que sea
 * futura) — su ventana de check-in (`starts_at - 2h`) ya está abierta
 * en el momento de crearla. Inscribe a `DEMO_PERSON_EMAIL` y devuelve su
 * token de check-in (`my-checkin`, solo válido para quien tiene plaza
 * `registered` en esa actividad).
 */
export async function createCheckinFixture(
  api: APIRequestContext,
  titularToken: string,
  orgId: number,
): Promise<CheckinFixture> {
  const eventTitle = "E2E — actividad de asistencia";
  // Un margen corto (validate_starts_at solo exige que sea futura): para
  // cuando el flujo de UI llegue a «Marcar asistió» (varias navegaciones
  // reales después), la actividad ya habrá empezado de verdad —
  // `mark_attendance` lo exige — y la ventana de check-in (que abre 2h
  // *antes* del inicio) llevará abierta desde el instante de crearla.
  const startsAt = new Date(Date.now() + 10 * 1000).toISOString();
  const createResponse = await api.post("/api/events/", {
    headers: authHeader(titularToken),
    data: {
      title: eventTitle,
      starts_at: startsAt,
      audience: "anyone",
      owner_org: orgId,
    },
  });
  if (!createResponse.ok()) {
    throw new Error(`no se pudo crear la actividad de fixture: ${createResponse.status()}`);
  }
  const event = (await createResponse.json()) as { id: string };

  const personToken = await apiLogin(api, DEMO_PERSON_EMAIL);
  const registerResponse = await api.post(`/api/events/${event.id}/register/`, {
    headers: authHeader(personToken),
    data: {},
  });
  if (!registerResponse.ok()) {
    throw new Error(`no se pudo inscribir a la persona de demo: ${registerResponse.status()}`);
  }

  const checkinResponse = await api.get(`/api/events/${event.id}/my-checkin/`, {
    headers: authHeader(personToken),
  });
  if (!checkinResponse.ok()) {
    throw new Error(`no se pudo obtener el token de check-in: ${checkinResponse.status()}`);
  }
  const checkin = (await checkinResponse.json()) as { token: string };

  // Segunda persona, para «Marcar asistió» a mano (distinta de la que
  // hace check-in por QR): registrarla y leer su propio `public_name`
  // (`GET .../users/me/`, nunca inventado a mano).
  const person2Token = await apiLogin(api, DEMO_PERSON_2_EMAIL);
  const register2Response = await api.post(`/api/events/${event.id}/register/`, {
    headers: authHeader(person2Token),
    data: {},
  });
  if (!register2Response.ok()) {
    throw new Error(`no se pudo inscribir a la segunda persona de demo: ${register2Response.status()}`);
  }
  const person2MeResponse = await api.get("/api/users/users/me/", {
    headers: authHeader(person2Token),
  });
  const person2Me = (await person2MeResponse.json()) as { profile: { public_name: string } };

  return {
    eventId: event.id,
    eventTitle,
    startsAt,
    token: checkin.token,
    secondPersonName: person2Me.profile.public_name,
    cleanup: async () => {
      await api.delete(`/api/events/${event.id}/`, { headers: authHeader(titularToken) });
    },
  };
}

/**
 * Escala el primer reporte `pending` de una entidad a la cola de
 * plataforma (`POST /api/safety/reports/{id}/escalate/`), para que el
 * flujo de plataforma tenga algo real que abrir: los reportes
 * sembrados de una entidad (`seed_panel_demo`, «Asociación Bidasoa»)
 * **no** aparecen en la cola global mientras no estén escalados —
 * `docs/SEGURIDAD_Y_MODERACION.md` §4: la cola de plataforma es «sin
 * entidad, escalados, o contra la propia entidad», nunca todos los
 * reportes de todas las entidades. Sin ningún reporte `pending` en esa
 * entidad, no hace nada (devuelve `false`).
 */
export async function escalateFirstPendingReport(
  api: APIRequestContext,
  titularToken: string,
  orgId: number,
): Promise<boolean> {
  const queueResponse = await api.get(
    `/api/safety/reports/queue/?organization=${orgId}&status=pending`,
    { headers: authHeader(titularToken) },
  );
  if (!queueResponse.ok()) return false;
  const reports = (await queueResponse.json()) as Array<{ id: string }>;
  if (reports.length === 0) return false;

  const escalateResponse = await api.post(`/api/safety/reports/${reports[0].id}/escalate/`, {
    headers: authHeader(titularToken),
    data: {},
  });
  return escalateResponse.ok();
}

/**
 * Comprueba el nombre con el que se descarga un informe.
 *
 * El nombre real lo pone el backend en `Content-Disposition`
 * (`popyplan-<slug>-<since>-<until>.<fmt>` para las exportaciones del
 * panel, `panel/viewsets.py`; `popyplan-programa-<id>.<fmt>` para el
 * informe de un programa, `programs/viewsets.py`) y el panel lo lee con
 * `lib/download/filenameFrom.ts`. Esa cabecera solo llega a `fetch()`
 * desde otro origen (panel en `:3100`, backend en `:8001`) si el backend
 * la expone: `pop/settings.py` ya declara
 * `CORS_EXPOSE_HEADERS = ['Content-Disposition']` (y `pop.settings_e2e`,
 * que usa el job `e2e` de CI, lo hereda con su `from .settings import *`),
 * así que lo normal es comprobar el nombre completo.
 *
 * **Respaldo documentado**: contra un backend anterior a ese cambio, el
 * navegador oculta la cabecera y `useExport`/`useProgramReport` caen a su
 * nombre por defecto (`informe.csv`, `informe-programa.csv`). Para no
 * dejar el test verde por casualidad en ese caso, se distingue leyendo
 * `Access-Control-Expose-Headers` de la propia respuesta (Playwright ve
 * las cabeceras de red reales, sin el filtro de CORS del navegador): solo
 * si el backend no la expone se acepta el nombre de respaldo.
 */
export function expectExportFilename(
  download: Download,
  response: Response,
  { pattern, fallback }: { pattern: RegExp; fallback: string },
): void {
  const headers = response.headers();
  const exposed = (headers["access-control-expose-headers"] ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .some((name) => name === "content-disposition" || name === "*");

  if (!exposed) {
    expect(
      download.suggestedFilename(),
      "el backend no expone Content-Disposition (CORS): se espera el nombre de respaldo del panel",
    ).toBe(fallback);
    return;
  }

  expect(headers["content-disposition"] ?? "").toMatch(pattern);
  expect(download.suggestedFilename()).toMatch(pattern);
}
