/**
 * Renueva el access token para las páginas del servidor (Server
 * Components) en cada navegación protegida.
 *
 * Motivo: desde la tarea W3 la cookie httpOnly (`pp_session`,
 * `lib/auth/cookie.ts`) guarda un **refresh token** (no un access token
 * como antes), y `POST /api/auth/token/refresh/` **rota** ese refresh en
 * cada uso (`ROTATE_REFRESH_TOKENS=True`, `docs/PANEL.md` §0). Un Server
 * Component (`lib/auth/session.ts::getServerSession`, usado por los
 * layouts de `/entidad`, `/paraguas` y `/plataforma`) no puede escribir
 * cookies — si intentara refrescar él mismo, la cookie rotada se perdería
 * y la sesión moriría en la siguiente petición (el refresh anterior ya
 * quedó en lista negra). El middleware sí puede escribir cookies en la
 * respuesta, así que hace el refresco aquí, una vez por navegación:
 *
 * 1. Lee el refresh de la cookie. Sin cookie, una navegación de documento
 *    va derecha a `/login?returnTo=<destino>` (hallazgo B1: con
 *    `SameSite=Strict` un enlace profundo llegado de fuera no manda la
 *    cookie, y antes se perdía el destino); un prefetch/RSC sin cookie
 *    sigue pasando tal cual, y el layout que llame a `getServerSession()`
 *    redirigirá como siempre.
 * 2. Llama a `POST /api/auth/token/refresh/` con **single-flight**
 *    (`lib/auth/singleFlight.ts`, indexado por el valor del refresh):
 *    varias peticiones concurrentes con la misma cookie (RSC, prefetch,
 *    `restoreSession` del cliente) comparten una única llamada al backend
 *    — sin esto, cada una rotaría el refresh por su cuenta y la última
 *    recibiría 401 (el refresh que envió ya está en lista negra) y
 *    destruiría la sesión de quien acababa de entrar (mismo bug que
 *    `lib/api/client.ts` arregló con `inFlightRefresh`).
 * 3. Si el backend rechaza el refresh (caducado, en lista negra), manda a
 *    `/login?returnTo=<destino>` **solo en navegaciones de documento**
 *    (`sec-fetch-dest: document`, o sin la cabecera — navegadores
 *    antiguos, curl, Playwright viejo); un prefetch/RSC
 *    (`sec-fetch-dest` distinto de `document`) pasa sin sesión y lo
 *    resolverá la navegación de documento siguiente. **Este middleware no
 *    borra nunca la cookie** (hallazgo F3): el single-flight del punto 2
 *    cierra la carrera de rotación *dentro de este proceso*, pero no
 *    entre runtimes (el middleware corre en Edge y
 *    `app/api/session/refresh/route.ts` en Node, con su propio
 *    `lib/auth/rotationCache.ts`) ni entre instancias. O sea: un 401 de
 *    aquí puede ser el de un refresh que otro proceso acaba de rotar con
 *    éxito hace milisegundos, con la sesión perfectamente sana — y
 *    borrarlo tiraba también el refresh nuevo que el navegador ya tenía.
 *    Quien borra la cookie es el route handler `/api/session/refresh`
 *    (que sí consulta esa caché de replay antes de darla por caducada) o
 *    el logout. La cookie de más que se queda en el navegador no es un
 *    bucle: `/login` está **fuera** del `matcher` de abajo, así que el
 *    middleware no vuelve a correr allí, y la restauración de arranque de
 *    `app/providers.tsx` llama a ese route handler, que la borra con su
 *    401 si de verdad estaba caducada.
 * 4. Si el backend no responde (error de red), o responde 200 con algo
 *    que no son los dos tokens del contrato
 *    (`lib/auth/tokenRefresh.ts::parseRefreshedTokens`, hallazgo B3),
 *    devuelve **503** en vez de dejar pasar «sin sesión»: sin cabecera de
 *    acceso los layouts redirigirían a `/login` con la sesión todavía
 *    válida, y sin la comprobación de los tokens la cookie acababa
 *    valiendo la cadena `"undefined"`.
 * 5. Si sale bien, guarda el refresh nuevo en la cookie (rotación) y
 *    añade el access token a la petición reenviada como cabecera interna
 *    (`ACCESS_TOKEN_HEADER`) — nunca llega al navegador, la lee
 *    `lib/auth/session.ts` con `headers()` de `next/headers`.
 *
 * En todos los caminos que dejan pasar la petición, la cabecera interna
 * se **borra** de las cabeceras reenviadas (hallazgo B2): si no, un
 * cliente sin cookie podría mandar `x-pp-access-token` a mano y los
 * Server Components lo tomarían por una sesión válida.
 *
 * Las llamadas al backend llevan la IP real del cliente
 * (`lib/auth/clientIp.ts`, hallazgo A1): el límite por IP del backend es
 * común a login y refresco, así que sin ella los refrescos del servidor
 * de Next agotan el cupo de login de todo el mundo.
 */
import { NextRequest, NextResponse } from "next/server";

import { apiBaseUrl } from "@/lib/api/baseUrl";
import { AUTH } from "@/lib/api/endpoints";
import { forwardedForHeaders } from "@/lib/auth/clientIp";
import { ACCESS_TOKEN_HEADER, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/cookie";
import { singleFlight } from "@/lib/auth/singleFlight";
import { parseRefreshedTokens } from "@/lib/auth/tokenRefresh";

type RefreshOutcome =
  | { ok: true; access: string; refresh: string }
  /**
   * `rechazado`: el backend dice que no (caducado, en lista negra, o
   * rotado por otro proceso hace un instante) — al login, sin tocar la
   * cookie (punto 3 del docstring). `ilegible`: respondió 200 con algo que no es la
   * pareja de tokens del contrato (proxy, despliegue a medias) — la sesión
   * puede estar perfectamente sana, así que se trata como el backend caído
   * (`lib/auth/tokenRefresh.ts`, hallazgo B3).
   */
  | { ok: false; reason: "rechazado" | "ilegible" };

/**
 * Refrescos en vuelo indexados por el valor del refresh token: peticiones
 * concurrentes con la misma cookie comparten la misma promesa (y por tanto
 * una sola llamada al backend) — imprescindible porque cada uso rota el
 * refresh y deja el anterior en lista negra. La entrada se elimina en el
 * `finally` de `singleFlight`, cuando la promesa ya está resuelta.
 */
const inFlightByRefresh = new Map<string, Promise<RefreshOutcome>>();

async function doRefreshToken(refresh: string, request: NextRequest): Promise<RefreshOutcome> {
  const refreshResponse = await fetch(`${apiBaseUrl()}${AUTH.TOKEN_REFRESH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...forwardedForHeaders(request) },
    body: JSON.stringify({ refresh }),
  });
  if (!refreshResponse.ok) return { ok: false, reason: "rechazado" };

  const tokens = parseRefreshedTokens(await refreshResponse.json().catch(() => null));
  if (!tokens) return { ok: false, reason: "ilegible" };
  return { ok: true, access: tokens.access, refresh: tokens.refresh };
}

/** `true` para navegaciones de documento (o sin la cabecera, p. ej. curl). */
function isDocumentNavigation(request: NextRequest): boolean {
  const dest = request.headers.get("sec-fetch-dest");
  return dest === null || dest === "document";
}

/**
 * Deja pasar la petición sin sesión, quitando la cabecera interna de
 * acceso por si el cliente la mandó a mano (hallazgo B2).
 */
function passThroughWithoutAccess(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(ACCESS_TOKEN_HEADER);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

/**
 * Redirección al login guardando el destino (`returnTo`). La raíz no lo
 * necesita: `app/page.tsx` ya decide el área a la que llevar tras entrar.
 */
function redirectToLogin(request: NextRequest): NextResponse {
  const target = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  // `nextUrl.clone()` en vez de `new URL(..., request.url)`: conserva el
  // origen público (`x-forwarded-host`) y el `basePath` si algún día lo hay.
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  if (request.nextUrl.pathname !== "/") {
    loginUrl.searchParams.set("returnTo", target);
  }
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const refresh = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!refresh) {
    if (!isDocumentNavigation(request)) return passThroughWithoutAccess(request);
    return redirectToLogin(request);
  }

  let outcome: RefreshOutcome;
  try {
    outcome = await singleFlight(inFlightByRefresh, refresh, () =>
      doRefreshToken(refresh, request),
    );
  } catch {
    // Backend caído/inaccesible (o respuesta ilegible): mejor 503
    // (reintento del navegador o error explícito) que dejar pasar sin
    // cabecera y que los layouts redirijan a /login con la sesión
    // todavía válida.
    return new NextResponse(null, { status: 503 });
  }

  if (!outcome.ok) {
    if (outcome.reason === "ilegible") {
      // No es que la sesión haya caducado: el backend contestó algo que no
      // se entiende. Mismo trato que si no respondiera.
      return new NextResponse(null, { status: 503 });
    }
    if (!isDocumentNavigation(request)) {
      // Prefetch/RSC: la petición pasa sin sesión y el layout que llame a
      // `getServerSession()` redirigirá; la navegación de documento
      // siguiente repetirá este refresco.
      return passThroughWithoutAccess(request);
    }
    // Navegación de documento: al login con el destino, pero **sin**
    // borrar la cookie (hallazgo F3, ver el docstring del módulo).
    return redirectToLogin(request);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(ACCESS_TOKEN_HEADER, outcome.access);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set(SESSION_COOKIE_NAME, outcome.refresh, sessionCookieOptions());
  return response;
}

export const config = {
  matcher: [
    // La raíz entra en el matcher (hallazgo A2): `app/page.tsx` resuelve
    // el área con `getServerSession()`, que solo lee la cabecera interna
    // que pone este middleware — fuera del matcher, cualquier
    // `redirect("/")` de un layout acababa en el login con la sesión viva.
    "/",
    "/entidad/:path*",
    "/paraguas/:path*",
    "/plataforma/:path*",
    "/elegir-entidad",
  ],
};
