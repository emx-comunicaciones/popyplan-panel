# Landing pública y login único — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que `/` deje de redirigir al login y sea una web pública de presentación de Popyplan, con el login único ya existente como puerta de entrada y una pantalla «Tu cuenta es de la app» para quien entra sin ningún rol de panel.

**Architecture:** `app/page.tsx` sigue siendo el repartidor de áreas, pero gana dos ramas de render en vez de redirigir: sin sesión pinta `<Landing />` (Server Component compuesto por bloques en `components/landing/`), y con sesión sin acceso pinta `<AppAccountScreen />`. `middleware.ts` mantiene la raíz en su `matcher` (sigue refrescando la cookie para que el reparto de área funcione), pero deja pasar sin sesión en vez de mandar al login cuando la petición es a `/`. La configuración pública (URL del sitio, correo de contacto, fichas de tienda) vive en `lib/config/site.ts`, con el mismo patrón de lectura de `process.env` dentro de la función que `lib/api/baseUrl.ts`. SEO con `app/robots.ts`, `app/sitemap.ts` y `generateMetadata` con Open Graph.

**Tech Stack:** Next.js 15 (App Router, Server Components), TypeScript estricto, Tailwind CSS 4 (tokens de `app/globals.css`), next-intl v4 (sin enrutado de idioma), TanStack Query 5, Vitest + Testing Library + vitest-axe, Playwright (e2e contra el backend real).

**Spec:** `docs/superpowers/specs/2026-09-20-landing-login-unico-design.md` (autoridad vinculante; el plan argumenta desde ella y se lee junto con ella).

**Worktree:** todo el trabajo ocurre en `/Users/mikelerrasti/Code/popyplan-panel/.worktrees/landing` (rama `feature/landing-login-unico`). **Nunca** `git stash`. Si el worktree no tiene `node_modules/`, ejecutar `npm ci` antes de la Tarea 1 (es un árbol de trabajo aparte del repo principal y no comparte dependencias).

## Global Constraints

Estas reglas valen para **todas** las tareas, aunque una tarea concreta no las repita:

- **Textos de UI en los cuatro catálogos** `messages/{en,es,eu,ca}.json`. El inglés (`en`) es la **cadena fuente** del código y **nunca se ofrece como idioma de interfaz** (`lib/i18n/languages.ts::SUPPORTED_LANGUAGES` = `["es","eu","ca"]`). Euskera en batua (Euskaltzaindia), catalán en la forma general del IEC. `lib/i18n/messages.test.ts` (paridad de claves hoja, valores no vacíos y mismos parámetros ICU) tiene que quedar verde al final de cada tarea.
- **Ningún literal de texto en JSX**: `eslint.config.mjs` activa `react/jsx-no-literals` (`noStrings: true`, `ignoreProps: true`) sobre `app/**/*.tsx` y `components/**/*.tsx` (sin tests) — todo texto pasa por `t()`. Y `no-restricted-syntax` prohíbe un `Literal` con letras como hijo directo de `aria-label`, `aria-description`, `placeholder`, `title` o `alt`.
- **`text-primary-700` para texto, enlaces, botones y bordes de control**; `bg-primary`/`primary-100` **solo** para superficies decorativas sin texto. Nunca `text-primary`/`bg-primary` a secas (`grep -rn "text-primary\b\|bg-primary\b" app components` no debe encontrar nada nuevo).
- **Sin sombras** (`shadow-*`): el borde de 1px ya separa cada bloque del fondo (pasada de densidad 2026-09-20).
- **Objetivos interactivos de 32px de alto como mínimo** (`min-h-8`), incluidos los enlaces con aspecto de botón.
- **`components/layout/Footer.tsx` en todas las páginas públicas** (es donde el RD 1112/2018 exige que la declaración de accesibilidad sea localizable).
- **Nunca `git stash`** en este worktree.
- **Umbral de cobertura: 99,7 % de líneas** (`vitest.config.ts::coverage.thresholds.lines`), medido sobre `lib/**`, `hooks/**`, `app/**/*.ts` y `middleware.ts` — los `.tsx` no cuentan, así que `lib/config/site.ts`, `app/robots.ts` y `app/sitemap.ts` **sí** necesitan test propio.
- **Puerto 3100 para el servidor de desarrollo de los e2e** (`playwright.config.ts`), nunca 3000 (ese es el panel de demo del propietario en `.worktrees/demo/`).
- **Límite de login: 5 intentos por 60 segundos por IP** en local (`users/rate_limiting.py`, clave `ip:<ip>:auth`, compartida entre cuentas): un spec de Playwright no puede hacer más de cuatro o cinco logins seguidos. `pop.settings_e2e` lo desactiva en CI.
- Textos de UI en español (y sus tres traducciones); identificadores de código en inglés; mensajes de commit en español.

---

## Mapa de ficheros

**Nuevos:**

| Fichero | Responsabilidad |
|---|---|
| `lib/config/site.ts` | `siteUrl()`, `contactEmail()`, `storeLinks()` — única lectura de las cuatro variables públicas nuevas. |
| `lib/config/site.test.ts` | Valores por defecto, barra final, tiendas vacías → `null`. |
| `components/landing/linkStyles.ts` | Las dos clases de enlace con aspecto de botón (primario/secundario), para no repetirlas en cinco ficheros. |
| `components/landing/mailto.ts` | `mailtoHref(email, subject)` con `encodeURIComponent`. |
| `components/landing/StoreLinks.tsx` | Botones de tienda; `null` si no hay ninguna URL configurada. |
| `components/landing/AppAccountScreen.tsx` | Pantalla «Tu cuenta es de la app» (spec §5). |
| `components/landing/LandingHeader.tsx` | Marca, selector de idioma y «Entrar». |
| `components/landing/Hero.tsx` | Portada: `<h1>`, subtítulo y las dos llamadas. |
| `components/landing/Audiences.tsx` | Cuatro tarjetas de público. |
| `components/landing/HowItWorks.tsx` | Tres pasos. |
| `components/landing/Privacy.tsx` | Compromisos del sistema. |
| `components/landing/Contact.tsx` | «Habla con nosotros» con `mailto:`. |
| `components/landing/Landing.tsx` | Compone los bloques en orden + `Footer`. |
| `app/robots.ts` / `app/robots.test.ts` | `/robots.txt`. |
| `app/sitemap.ts` / `app/sitemap.test.ts` | `/sitemap.xml`. |
| `public/og.png` | Imagen de compartir 1200×630 (generada con un script único que **no** se commitea). |
| `e2e/landing.spec.ts` | Los tres flujos de la spec §7. |

**Modificados:**

| Fichero | Cambio |
|---|---|
| `middleware.ts` | `/` deja de ir al login sin cookie o con el refresh rechazado. |
| `middleware.test.ts` | Casos de la raíz pública. |
| `app/page.tsx` | Ramas de render (landing / cuenta de app) + `generateMetadata`. |
| `app/page.test.tsx` | Casos nuevos; los redirects existentes se conservan. |
| `messages/{en,es,eu,ca}.json` | `landing.*` nuevo; `pages.home.*` retirado. |
| `.env.example` | Las cuatro variables nuevas con la nota de build. |
| `CLAUDE.md` / `AGENTS.md` | Sección «Landing pública y login único (2026-09-20)» + bullet de cobertura. |

---

### Task 1: Configuración pública (`lib/config/site.ts`)

**Files:**
- Create: `lib/config/site.ts`
- Create: `lib/config/site.test.ts`
- Modify: `.env.example` (añadir bloque al final)

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces:
  - `siteUrl(): string` — `NEXT_PUBLIC_SITE_URL` sin barra final, o `"http://localhost:3100"`.
  - `contactEmail(): string` — `NEXT_PUBLIC_CONTACT_EMAIL`, o `"hola@popyplan.com"`.
  - `storeLinks(): StoreUrls` con `interface StoreUrls { appStore: string | null; playStore: string | null }` — `null` cuando la variable falta o está vacía.

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/config/site.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { contactEmail, siteUrl, storeLinks } from "./site";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("siteUrl", () => {
  it("devuelve la URL configurada", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://popyplan.com");

    expect(siteUrl()).toBe("https://popyplan.com");
  });

  it("quita la barra final (una o varias) para no generar URLs con doble barra", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://popyplan.com/");
    expect(siteUrl()).toBe("https://popyplan.com");

    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://popyplan.com///");
    expect(siteUrl()).toBe("https://popyplan.com");
  });

  it("ignora los espacios alrededor del valor", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "  https://popyplan.com  ");

    expect(siteUrl()).toBe("https://popyplan.com");
  });

  it("sin la variable cae al panel local (puerto 3100, el de los e2e)", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);

    expect(siteUrl()).toBe("http://localhost:3100");
  });

  it("con la variable vacía se comporta como si no estuviera definida", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "   ");

    expect(siteUrl()).toBe("http://localhost:3100");
  });
});

describe("contactEmail", () => {
  it("devuelve el correo configurado", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "entidades@popyplan.com");

    expect(contactEmail()).toBe("entidades@popyplan.com");
  });

  it("sin la variable usa el correo por defecto", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", undefined);

    expect(contactEmail()).toBe("hola@popyplan.com");
  });

  it("con la variable vacía usa el correo por defecto", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "  ");

    expect(contactEmail()).toBe("hola@popyplan.com");
  });
});

describe("storeLinks", () => {
  it("devuelve las dos fichas configuradas", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "https://apps.apple.com/app/popyplan/id1");
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", "https://play.google.com/store/apps/details?id=com.popyplan");

    expect(storeLinks()).toEqual({
      appStore: "https://apps.apple.com/app/popyplan/id1",
      playStore: "https://play.google.com/store/apps/details?id=com.popyplan",
    });
  });

  it("una tienda ausente o vacía es null (su botón no se pinta)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "   ");
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", undefined);

    expect(storeLinks()).toEqual({ appStore: null, playStore: null });
  });

  it("recorta los espacios alrededor de cada URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "  https://apps.apple.com/app/popyplan/id1  ");
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", undefined);

    expect(storeLinks().appStore).toBe("https://apps.apple.com/app/popyplan/id1");
  });
});
```

- [ ] **Step 2: Ejecutar el test para comprobar que falla**

Run: `npx vitest run lib/config/site.test.ts`
Expected: FAIL — `Failed to resolve import "./site"` (el módulo no existe todavía).

- [ ] **Step 3: Implementar `lib/config/site.ts`**

```ts
/**
 * Configuración pública de la web de presentación (spec de diseño
 * `2026-09-20-landing-login-unico-design.md` §3.4 y §8).
 *
 * Mismo patrón que `lib/api/baseUrl.ts` (hallazgo B9): cada variable se
 * lee **dentro** de la función que la necesita, nunca a nivel de módulo
 * — un valor congelado al importar rompería `next build` en un entorno
 * que todavía no tiene la variable, y dejaría los tests sin poder
 * sustituirla con `vi.stubEnv`.
 *
 * Diferencia deliberada con `apiBaseUrl()`: aquí **no se lanza** cuando
 * falta la variable en producción. Sin `NEXT_PUBLIC_API_URL` el panel no
 * puede hacer nada (mejor fallar en voz alta); sin `NEXT_PUBLIC_SITE_URL`
 * la landing se pinta perfectamente y lo único que sale mal es un sitemap
 * y unas tarjetas de compartir apuntando a `localhost` — tirar la página
 * pública entera por eso sería peor que el problema que resuelve.
 *
 * **`NEXT_PUBLIC_*` se incrusta en el bundle al construir**: quien
 * despliegue tiene que declarar estas cuatro variables en el entorno de
 * `next build`, no solo en el de ejecución (`.env.example` lo dice al
 * lado de cada una).
 */
const DEFAULT_SITE_URL = "http://localhost:3100";
const DEFAULT_CONTACT_EMAIL = "hola@popyplan.com";

/** URL absoluta del sitio público, **sin** barra final. */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  return DEFAULT_SITE_URL;
}

/** Destino del `mailto:` de la landing (spec §2, decisión 5). */
export function contactEmail(): string {
  return process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || DEFAULT_CONTACT_EMAIL;
}

export interface StoreUrls {
  appStore: string | null;
  playStore: string | null;
}

/**
 * Fichas de la app en las tiendas. Una variable ausente o vacía devuelve
 * `null` y su botón **no se pinta** (`components/landing/StoreLinks.tsx`):
 * enlazar a una ficha que todavía no existe es peor que no ofrecer el
 * botón.
 */
export function storeLinks(): StoreUrls {
  return {
    appStore: process.env.NEXT_PUBLIC_APP_STORE_URL?.trim() || null,
    playStore: process.env.NEXT_PUBLIC_PLAY_STORE_URL?.trim() || null,
  };
}
```

- [ ] **Step 4: Ejecutar el test para comprobar que pasa**

Run: `npx vitest run lib/config/site.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Documentar las variables en `.env.example`**

Añadir al final de `.env.example` (después del bloque «Notas de despliegue»):

```
# ---------------------------------------------------------------------
# Landing pública (`/`) y contacto
# ---------------------------------------------------------------------
# URL absoluta del sitio público, sin barra final. La usan `app/sitemap.ts`,
# `app/robots.ts` (que apunta ahí el sitemap) y el Open Graph de la landing
# (`app/page.tsx::generateMetadata`). Si falta, se usa http://localhost:3100
# (el puerto del panel en los e2e): en producción eso deja el sitemap y las
# tarjetas de compartir apuntando a localhost, así que hay que declararla.
# OJO, como NEXT_PUBLIC_API_URL: toda variable NEXT_PUBLIC_* se INCRUSTA en
# el bundle al CONSTRUIR (`next build`), no se lee en runtime — declararla
# solo en el entorno de ejecución no sirve de nada.
NEXT_PUBLIC_SITE_URL=http://localhost:3100

# Destino del `mailto:` de la landing («Escríbenos», con un asunto por
# público). Si falta, se usa hola@popyplan.com.
# NEXT_PUBLIC_CONTACT_EMAIL=hola@popyplan.com

# Fichas de la app en las tiendas. Vacías o ausentes => el botón NO se
# pinta (ni en la landing ni en la pantalla «Tu cuenta es de la app»), en
# vez de enlazar a una ficha que todavía no existe. Se leen al construir,
# igual que las de arriba.
# NEXT_PUBLIC_APP_STORE_URL=https://apps.apple.com/app/popyplan/id000000000
# NEXT_PUBLIC_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=com.popyplan
```

- [ ] **Step 6: Verificación completa**

Run: `npm run typecheck && npm run lint && npx vitest run lib/config/site.test.ts`
Expected: sin errores de tipos, 0 avisos de ESLint, tests en verde.

- [ ] **Step 7: Commit**

```bash
git add lib/config/site.ts lib/config/site.test.ts .env.example
git commit -m "$(cat <<'EOF'
feat(config): configuración pública de la landing (URL, contacto y tiendas)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Middleware — la raíz es pública

**Files:**
- Modify: `middleware.ts` (docstring del módulo, `redirectToLogin`, cuerpo de `middleware`)
- Test: `middleware.test.ts`

**Interfaces:**
- Consumes: nada de la Tarea 1.
- Produces: `/` deja pasar la petición sin cabecera de acceso (en vez de redirigir a `/login`) cuando no hay cookie de sesión o el backend rechaza el refresh. Con cookie válida, la raíz **sigue** recibiendo `x-pp-access-token` y la cookie rotada, que es lo que `app/page.tsx` necesita para repartir por área (hallazgo A2). Ninguna otra ruta del `matcher` cambia.

- [ ] **Step 1: Escribir los tests que fallan**

En `middleware.test.ts`, **sustituir** el test existente `"sin cookie en la raíz, redirige al login sin returnTo"` (líneas 76-80) por estos tres, dejando el resto del fichero intacto:

```ts
  it("sin cookie en la raíz deja pasar sin sesión: la landing es pública", async () => {
    const res = await middleware(
      requestWithCookie(
        undefined,
        { [ACCESS_TOKEN_HEADER]: "access-falsificado" },
        "http://panel.test/",
      ),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    // La cabecera interna se borra igual que en cualquier otro camino sin
    // sesión (hallazgo B2): un visitante anónimo no puede forjarla.
    expect(forwardedHeaderNames(res)).not.toHaveLength(0);
    expect(forwardedHeaderNames(res)).not.toContain(ACCESS_TOKEN_HEADER);
    expect(res.headers.get(`x-middleware-request-${ACCESS_TOKEN_HEADER}`)).toBeNull();
  });

  it("con el refresh rechazado en la raíz tampoco redirige al login", async () => {
    fetchMock.mockResolvedValueOnce(response({ detail: "token_not_valid" }, 401));

    const res = await middleware(
      requestWithCookie("refresh-caducado", { "sec-fetch-dest": "document" }, "http://panel.test/"),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("con refresh válido la raíz sigue recibiendo el access (reparto de área)", async () => {
    fetchMock.mockResolvedValueOnce(
      response({ access: "access-nuevo", refresh: "refresh-nuevo" }, 200),
    );

    const res = await middleware(requestWithCookie("refresh-viejo", undefined, "http://panel.test/"));

    expect(res.headers.get(`x-middleware-request-${ACCESS_TOKEN_HEADER}`)).toBe("access-nuevo");
    expect(res.cookies.get(SESSION_COOKIE_NAME)?.value).toBe("refresh-nuevo");
  });
```

- [ ] **Step 2: Ejecutar los tests para comprobar que fallan**

Run: `npx vitest run middleware.test.ts`
Expected: FAIL — los dos primeros tests nuevos fallan con `expected 307 to be 200` (la raíz todavía redirige al login); el tercero ya pasa.

- [ ] **Step 3: Implementar el cambio en `middleware.ts`**

3.1. En el docstring del módulo, sustituir el **punto 1** por:

```
 * 1. Lee el refresh de la cookie. Sin cookie, una navegación de documento
 *    va derecha a `/login?returnTo=<destino>` (hallazgo B1: con
 *    `SameSite=Strict` un enlace profundo llegado de fuera no manda la
 *    cookie, y antes se perdía el destino); un prefetch/RSC sin cookie
 *    sigue pasando tal cual, y el layout que llame a `getServerSession()`
 *    redirigirá como siempre. **La raíz es la excepción** (spec de diseño
 *    `2026-09-20-landing-login-unico-design.md` §3.2): `/` es la landing
 *    pública, así que sin cookie pasa sin sesión —también en una
 *    navegación de documento— y `app/page.tsx` la pinta.
```

3.2. En el mismo docstring, al final del **punto 3**, añadir:

```
 *    En `/` no se redirige nunca: un refresh rechazado deja ver la
 *    landing pública, no el login (spec §3.2).
```

3.3. Sustituir `redirectToLogin` por:

```ts
/**
 * Redirección al login guardando el destino (`returnTo`).
 *
 * Ya no hay excepción para la raíz: desde la landing pública (spec de
 * diseño `2026-09-20-landing-login-unico-design.md` §3.2), `/` **nunca**
 * llega hasta aquí — sin cookie, o con el refresh rechazado, se deja
 * pasar sin sesión (`passThroughWithoutAccess`) y `app/page.tsx` pinta la
 * landing. Toda ruta que sí llega a esta función es una ruta protegida
 * del panel, así que siempre hay un destino que guardar.
 */
function redirectToLogin(request: NextRequest): NextResponse {
  const target = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  // `nextUrl.clone()` en vez de `new URL(..., request.url)`: conserva el
  // origen público (`x-forwarded-host`) y el `basePath` si algún día lo hay.
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("returnTo", target);
  return NextResponse.redirect(loginUrl);
}
```

3.4. Añadir, justo debajo de `redirectToLogin`:

```ts
/**
 * `/` es pública desde la landing (spec §3.1/§3.2). Sigue en el `matcher`
 * porque **con** cookie hay que refrescar la sesión para que
 * `app/page.tsx` sepa a qué área mandar (hallazgo A2), pero sin cookie —o
 * con el refresh rechazado— la petición pasa sin sesión en vez de ir al
 * login: quien todavía no tiene cuenta tiene que poder leer la web.
 */
function isPublicRoot(request: NextRequest): boolean {
  return request.nextUrl.pathname === "/";
}
```

3.5. En el cuerpo de `middleware`, sustituir el bloque `if (!refresh) { … }` por:

```ts
  if (!refresh) {
    if (isPublicRoot(request) || !isDocumentNavigation(request)) {
      return passThroughWithoutAccess(request);
    }
    return redirectToLogin(request);
  }
```

3.6. Dentro de `if (!outcome.ok) { … }`, sustituir el bloque que hoy dice `if (!isDocumentNavigation(request)) { … }` + `return redirectToLogin(request);` por:

```ts
    if (isPublicRoot(request) || !isDocumentNavigation(request)) {
      // Prefetch/RSC: la petición pasa sin sesión y el layout que llame a
      // `getServerSession()` redirigirá; la navegación de documento
      // siguiente repetirá este refresco. La raíz pasa siempre: es la
      // landing pública (spec §3.2).
      return passThroughWithoutAccess(request);
    }
    // Navegación de documento a una ruta protegida: al login con el
    // destino, pero **sin** borrar la cookie (hallazgo F3, ver el
    // docstring del módulo).
    return redirectToLogin(request);
```

3.7. En `config.matcher`, sustituir el comentario de la raíz por:

```ts
    // La raíz entra en el matcher (hallazgo A2): `app/page.tsx` resuelve
    // el área con `getServerSession()`, que solo lee la cabecera interna
    // que pone este middleware — fuera del matcher, cualquier
    // `redirect("/")` de un layout acababa en el login con la sesión viva.
    // Desde la landing (spec §3.2) sigue aquí por el mismo motivo, pero
    // sin cookie **no** redirige: pasa sin sesión y se pinta la landing.
    "/",
```

- [ ] **Step 4: Ejecutar los tests para comprobar que pasan**

Run: `npx vitest run middleware.test.ts`
Expected: PASS — todos los tests del fichero, incluidos los tres nuevos y `"sin cookie de sesión, redirige al login con el destino y sin llamar al backend"` (`/entidad/alfaville` sigue yendo a `/login?returnTo=%2Fentidad%2Falfaville`).

- [ ] **Step 5: Comprobar que el middleware sigue al 100 % de cobertura**

Run: `npx vitest run --coverage middleware.test.ts`
Expected: la fila `middleware.ts` del informe sigue a 100 % de líneas (la rama `pathname !== "/"` que se ha quitado era la única que la raíz ejercitaba en esa función).

- [ ] **Step 6: Verificación completa**

Run: `npm run typecheck && npm run lint && npx vitest run middleware.test.ts`
Expected: todo en verde.

- [ ] **Step 7: Commit**

```bash
git add middleware.ts middleware.test.ts
git commit -m "$(cat <<'EOF'
feat(middleware): la raíz es pública y deja pasar sin sesión

Sin cookie, o con el refresh rechazado, `/` ya no va a `/login`: pasa sin
cabecera de acceso para que `app/page.tsx` pueda pintar la landing. Con
cookie válida sigue refrescando y reenviando el access, que es lo que
necesita el reparto por área (hallazgo A2). El resto del matcher no cambia.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Pantalla «Tu cuenta es de la app»

**Files:**
- Create: `components/landing/linkStyles.ts`
- Create: `components/landing/StoreLinks.tsx`
- Create: `components/landing/AppAccountScreen.tsx`
- Modify: `app/page.tsx` (rama `sin-acceso`)
- Modify: `messages/en.json`, `messages/es.json`, `messages/eu.json`, `messages/ca.json`
- Test: `app/page.test.tsx`

**Interfaces:**
- Consumes: `storeLinks()` de `lib/config/site.ts` (Tarea 1).
- Produces:
  - `PRIMARY_LINK_CLASS` y `SECONDARY_LINK_CLASS` (`components/landing/linkStyles.ts`), usados también por las Tareas 4 y 5.
  - `<StoreLinks label?: string />` — componente **síncrono**; devuelve `null` si `storeLinks()` no trae ninguna URL.
  - `<AppAccountScreen />` — componente **síncrono**.
  - Claves de catálogo `landing.stores.*` y `landing.appAccount.*`.
  - `pages.home.noAccessTitle`/`noAccessDescription` dejan de existir en los cuatro catálogos.

> **Gotcha imprescindible (vale para las Tareas 3, 4 y 5):** los componentes de `components/landing/` son Server Components **síncronos** que traducen con `useTranslations` de `next-intl` (soportado en RSC mientras el componente no sea `async`). No se usa `getTranslations` dentro de ellos porque eso obligaría a declararlos `async`, y Testing Library **no puede renderizar un componente async** dentro del árbol que devuelve un `page.tsx` (`render(await Home())` renderiza con `react-dom/client`, que no resuelve promesas de componente). Solo `app/page.tsx` y su `generateMetadata` son `async` y usan `getTranslations`, que es el patrón que ya sigue todo el repo. Ninguno lleva `"use client"`: no tienen interactividad propia.

- [ ] **Step 1: Escribir los tests que fallan**

En `app/page.test.tsx`: añadir `vi.unstubAllEnvs()` al `afterEach` existente y **sustituir** el test `"sin ningún acceso renderiza el estado de 'sin acceso' con salir de sesión"` por los cuatro siguientes (el resto del fichero no se toca). Añadir también el import de `axe`:

```ts
import { axe } from "@/test-utils/axe";
```

```ts
  function sessionWithoutAccess() {
    return {
      token: "t",
      me: buildMe({ org_memberships: [] }),
      platformRole: buildPlatformRole(null),
    };
  }

  it("sin ningún acceso no tiene violaciones de accesibilidad (axe)", async () => {
    getServerSessionMock.mockResolvedValue(sessionWithoutAccess());
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "https://apps.apple.com/app/popyplan/id1");
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", "https://play.google.com/store/apps/details?id=com.popyplan");

    const { container } = render(await Home());

    expect(await axe(container)).toHaveNoViolations();
  });

  it("sin ningún acceso pinta la pantalla de cuenta de la app con «Abrir la app» y «Cerrar sesión»", async () => {
    getServerSessionMock.mockResolvedValue(sessionWithoutAccess());

    render(await Home());

    expect(
      screen.getByRole("heading", { level: 1, name: "Tu cuenta es de la app Popyplan" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir la app" })).toHaveAttribute(
      "href",
      "popyplan://",
    );
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });

  it("sin tiendas configuradas no pinta ningún botón de tienda", async () => {
    getServerSessionMock.mockResolvedValue(sessionWithoutAccess());
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", undefined);

    render(await Home());

    expect(screen.queryByRole("link", { name: "Descargar en el App Store" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Descargar en Google Play" })).toBeNull();
  });

  it("con las tiendas configuradas pinta los dos botones con su URL", async () => {
    getServerSessionMock.mockResolvedValue(sessionWithoutAccess());
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "https://apps.apple.com/app/popyplan/id1");
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", "https://play.google.com/store/apps/details?id=com.popyplan");

    render(await Home());

    expect(screen.getByRole("link", { name: "Descargar en el App Store" })).toHaveAttribute(
      "href",
      "https://apps.apple.com/app/popyplan/id1",
    );
    expect(screen.getByRole("link", { name: "Descargar en Google Play" })).toHaveAttribute(
      "href",
      "https://play.google.com/store/apps/details?id=com.popyplan",
    );
  });
```

El `afterEach` del fichero queda así:

```ts
afterEach(() => {
  getServerSessionMock.mockReset();
  vi.unstubAllEnvs();
});
```

- [ ] **Step 2: Ejecutar los tests para comprobar que fallan**

Run: `npx vitest run app/page.test.tsx`
Expected: FAIL — los cuatro tests nuevos fallan porque la página sigue pintando el `ErrorState` «No tienes acceso a ningún área del panel» (`Unable to find an accessible element with the role "heading" and name "Tu cuenta es de la app Popyplan"`).

- [ ] **Step 3: Añadir las claves de catálogo (los cuatro idiomas)**

En `messages/en.json`, `messages/es.json`, `messages/eu.json` y `messages/ca.json`:

1. **Borrar** el nodo `"home"` completo dentro de `"pages"` (hoy solo tiene `noAccessTitle` y `noAccessDescription`; `grep -rn "pages.home\|noAccessTitle\|noAccessDescription" app components lib` confirma que `app/page.tsx` es su único consumidor y deja de usarlas en el paso 5).
2. **Añadir** un nodo `"landing"` de primer nivel (colócalo entre `"accessibility"` y `"entidad"` para que el orden sea el mismo en los cuatro ficheros).

`messages/en.json`:

```json
  "landing": {
    "stores": {
      "appStore": "Download on the App Store",
      "playStore": "Get it on Google Play"
    },
    "appAccount": {
      "title": "Your account belongs to the Popyplan app",
      "description": "This panel is for associations, public administrations and professionals. Your space is in the app: that is where your activities, your communities and your notices are.",
      "storesLabel": "Get the app",
      "openApp": "Open the app"
    }
  },
```

`messages/es.json`:

```json
  "landing": {
    "stores": {
      "appStore": "Descargar en el App Store",
      "playStore": "Descargar en Google Play"
    },
    "appAccount": {
      "title": "Tu cuenta es de la app Popyplan",
      "description": "Este panel es para asociaciones, administraciones y profesionales. Tu espacio está en la app: ahí tienes tus actividades, tus comunidades y tus avisos.",
      "storesLabel": "Descarga la app",
      "openApp": "Abrir la app"
    }
  },
```

`messages/eu.json`:

```json
  "landing": {
    "stores": {
      "appStore": "Deskargatu App Storen",
      "playStore": "Eskuratu Google Playn"
    },
    "appAccount": {
      "title": "Zure kontua Popyplan aplikaziokoa da",
      "description": "Panel hau elkarte, administrazio eta profesionalentzat da. Zure gunea aplikazioan dago: han dituzu zure jarduerak, zure komunitateak eta zure abisuak.",
      "storesLabel": "Deskargatu aplikazioa",
      "openApp": "Ireki aplikazioa"
    }
  },
```

`messages/ca.json`:

```json
  "landing": {
    "stores": {
      "appStore": "Descarrega'l a l'App Store",
      "playStore": "Aconsegueix-lo a Google Play"
    },
    "appAccount": {
      "title": "El teu compte és de l'aplicació Popyplan",
      "description": "Aquest panell és per a associacions, administracions i professionals. El teu espai és a l'aplicació: allà tens les teves activitats, les teves comunitats i els teus avisos.",
      "storesLabel": "Descarrega l'aplicació",
      "openApp": "Obre l'aplicació"
    }
  },
```

- [ ] **Step 4: Implementar los tres componentes**

`components/landing/linkStyles.ts`:

```ts
/**
 * Enlaces con aspecto de botón de la web pública. Son `<a>`, no
 * `components/ui/Button.tsx` (que renderiza un `<button>`): una llamada
 * que navega tiene que ser un enlace de verdad — con su menú contextual,
 * su «abrir en pestaña nueva» y su anuncio como enlace en un lector de
 * pantalla.
 *
 * Mismas medidas que `Button` tras la pasada de densidad (2026-09-20):
 * 32px de alto mínimo (`min-h-8`, el objetivo interactivo mínimo del
 * panel), 12px de relleno horizontal y texto de 13px (`text-sm`). Sin
 * sombra. El color de texto y de fondo sale de `primary-700`, nunca de
 * `primary` a secas (regla de contraste de `CLAUDE.md`: `primary` solo
 * para superficies decorativas sin texto).
 */
const BASE =
  "inline-flex min-h-8 items-center justify-center gap-2 rounded-md px-3 py-1 text-sm font-medium transition-colors";

export const PRIMARY_LINK_CLASS = `${BASE} bg-primary-700 text-text-inverse hover:bg-secondary-600`;

export const SECONDARY_LINK_CLASS = `${BASE} border border-border bg-white text-text-form hover:bg-border-light`;
```

`components/landing/StoreLinks.tsx`:

```tsx
import { useTranslations } from "next-intl";

import { storeLinks } from "@/lib/config/site";

import { SECONDARY_LINK_CLASS } from "./linkStyles";

export interface StoreLinksProps {
  /**
   * Etiqueta opcional encima de los botones («Descarga la app»). Cuando
   * no hay ninguna tienda configurada **tampoco se pinta la etiqueta**:
   * un rótulo suelto sin botones debajo se lee como algo que falta.
   */
  label?: string;
}

/**
 * Botones de tienda de la web pública (spec de diseño
 * `2026-09-20-landing-login-unico-design.md` §3.3). Solo se pinta la
 * tienda cuya URL está configurada (`NEXT_PUBLIC_APP_STORE_URL` /
 * `NEXT_PUBLIC_PLAY_STORE_URL`, `lib/config/site.ts`); sin ninguna de las
 * dos, el componente entero devuelve `null` — enlazar a una ficha que
 * todavía no existe es peor que no ofrecer el botón.
 *
 * Server Component **síncrono** con `useTranslations` (ver el gotcha de
 * la Tarea 3 del plan): un componente `async` dentro del árbol de
 * `app/page.tsx` no lo puede renderizar Testing Library.
 */
export function StoreLinks({ label }: StoreLinksProps = {}) {
  const { appStore, playStore } = storeLinks();
  const t = useTranslations("landing.stores");

  if (!appStore && !playStore) return null;

  return (
    <div className="flex flex-col gap-2">
      {label ? <p className="text-sm font-medium text-text-form">{label}</p> : null}
      <div className="flex flex-wrap gap-2">
        {appStore ? (
          <a href={appStore} className={SECONDARY_LINK_CLASS}>
            {t("appStore")}
          </a>
        ) : null}
        {playStore ? (
          <a href={playStore} className={SECONDARY_LINK_CLASS}>
            {t("playStore")}
          </a>
        ) : null}
      </div>
    </div>
  );
}
```

`components/landing/AppAccountScreen.tsx`:

```tsx
import { useTranslations } from "next-intl";

import { LogoutButton } from "@/components/LogoutButton";
import { Footer } from "@/components/layout/Footer";

import { PRIMARY_LINK_CLASS } from "./linkStyles";
import { StoreLinks } from "./StoreLinks";

/**
 * «Tu cuenta es de la app» (spec de diseño
 * `2026-09-20-landing-login-unico-design.md` §5, decisión 4): lo que ve
 * quien entra con una cuenta **sin ningún rol de panel** — una persona
 * usuaria de la app. Sustituye al `ErrorState` «No tienes acceso a ningún
 * área del panel» que había antes, que era correcto pero se leía como un
 * fallo del sistema y no ofrecía ninguna salida útil.
 *
 * `LogoutButton` es un Client Component; renderizarlo desde un Server
 * Component es el patrón normal de App Router (las tres cabeceras de área
 * ya lo hacen). El enlace «Abrir la app» usa el esquema propio
 * `popyplan://`: si la app no está instalada, el navegador simplemente no
 * hace nada — por eso los botones de tienda van justo encima.
 */
export function AppAccountScreen() {
  const t = useTranslations("landing.appAccount");

  return (
    <div className="flex min-h-screen flex-col bg-border-light">
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-lg border border-border bg-white p-4">
          <h1 className="mb-2 text-xl font-semibold text-text-base">{t("title")}</h1>
          <p className="mb-4 text-sm text-text-secondary">{t("description")}</p>
          <div className="mb-4">
            <StoreLinks label={t("storesLabel")} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href="popyplan://" className={PRIMARY_LINK_CLASS}>
              {t("openApp")}
            </a>
            <LogoutButton />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 5: Cambiar la rama `sin-acceso` de `app/page.tsx`**

Sustituir los imports de `LogoutButton`/`ErrorState`/`getTranslations` y el `return` final. El fichero queda así (la rama «sin sesión» sigue yendo a `/login` hasta la Tarea 4):

```tsx
import { redirect } from "next/navigation";

import { AppAccountScreen } from "@/components/landing/AppAccountScreen";
import { resolveArea } from "@/lib/auth/area";
import { getServerSession } from "@/lib/auth/session";

/**
 * Reparto de la raíz: manda a cada persona al área que le corresponde.
 *
 * Depende del middleware: `getServerSession()` solo lee la cabecera
 * interna `x-pp-access-token` que pone `middleware.ts` tras refrescar la
 * cookie, así que esta ruta **tiene que estar en su `matcher`** (hallazgo
 * A2: no lo estaba, y con la sesión viva la raíz siempre acababa en
 * `/login` — con ella, todos los `redirect("/")` de los layouts
 * —slug ajeno, rol de plataforma revocado— parecían un cierre de sesión y
 * el estado «sin acceso» de abajo era inalcanzable).
 *
 * Con sesión y `sin-acceso` se pinta `AppAccountScreen` (spec de diseño
 * `2026-09-20-landing-login-unico-design.md` §5): la cuenta existe y es
 * válida, solo que su sitio es la app, no el panel.
 */
export default async function Home() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  const area = resolveArea(session.me, session.platformRole);

  if (area === "plataforma") {
    redirect("/plataforma");
  }
  if (area !== "sin-acceso") {
    if (area.kind === "entidad") redirect(`/entidad/${area.slug}`);
    if (area.kind === "paraguas") redirect(`/paraguas/${area.slug}`);
    redirect("/elegir-entidad");
  }

  return <AppAccountScreen />;
}
```

- [ ] **Step 6: Ejecutar los tests para comprobar que pasan**

Run: `npx vitest run app/page.test.tsx lib/i18n/messages.test.ts`
Expected: PASS — los cuatro tests nuevos, los seis redirects que ya había y la paridad de los cuatro catálogos (las claves nuevas están en los cuatro y `pages.home` ya no está en ninguno).

- [ ] **Step 7: Verificación completa**

Run: `npm run typecheck && npm run lint && npx vitest run app/page.test.tsx lib/i18n/messages.test.ts`
Expected: todo en verde. Si ESLint marca `react/jsx-no-literals`, es que ha quedado un literal en JSX: extráelo a las cuatro traducciones, nunca lo añadas a `allowedStrings`.

- [ ] **Step 8: Commit**

```bash
git add components/landing app/page.tsx app/page.test.tsx messages
git commit -m "$(cat <<'EOF'
feat(landing): pantalla «Tu cuenta es de la app» para cuentas sin panel

Sustituye el ErrorState «No tienes acceso a ningún área del panel» por una
pantalla con los botones de tienda (solo si hay URL configurada), «Abrir la
app» y «Cerrar sesión». Las claves pages.home.noAccess* salen de los cuatro
catálogos al quedarse sin consumidor.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: La landing

**Files:**
- Create: `components/landing/mailto.ts`
- Create: `components/landing/LandingHeader.tsx`
- Create: `components/landing/Hero.tsx`
- Create: `components/landing/Audiences.tsx`
- Create: `components/landing/HowItWorks.tsx`
- Create: `components/landing/Privacy.tsx`
- Create: `components/landing/Contact.tsx`
- Create: `components/landing/Landing.tsx`
- Modify: `app/page.tsx` (rama sin sesión + `generateMetadata`)
- Modify: `messages/en.json`, `messages/es.json`, `messages/eu.json`, `messages/ca.json`
- Test: `app/page.test.tsx`

**Interfaces:**
- Consumes: `siteUrl()`, `contactEmail()` (Tarea 1); `PRIMARY_LINK_CLASS`, `SECONDARY_LINK_CLASS`, `<StoreLinks />` (Tarea 3).
- Produces:
  - `mailtoHref(email: string, subject: string): string`.
  - `<Landing />` (síncrono), compuesto por `<LandingHeader />`, `<Hero />`, `<Audiences />`, `<HowItWorks />`, `<Privacy />`, `<Contact />` y `<Footer />`.
  - `generateMetadata()` de `app/page.tsx` con `title.absolute`, `description`, `openGraph` y `twitter`.
  - Claves `landing.{meta,header,hero,audiences,how,privacy,contact}.*`.

- [ ] **Step 1: Escribir los tests que fallan**

En `app/page.test.tsx`, **sustituir** el test `"sin sesión redirige a /login"` por estos seis (el resto del fichero se conserva), y añadir `generateMetadata` al import de la página:

```ts
import Home, { generateMetadata } from "./page";
```

```ts
  it("sin sesión la landing no tiene violaciones de accesibilidad (axe)", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const { container } = render(await Home());

    expect(await axe(container)).toHaveNoViolations();
  });

  it("sin sesión pinta la landing con su portada y las cuatro tarjetas de público", async () => {
    getServerSessionMock.mockResolvedValue(null);

    render(await Home());

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Planes, comunidades y actividades para vivir bien acompañado",
      }),
    ).toBeInTheDocument();
    for (const name of [
      "Personas",
      "Asociaciones y ONG",
      "Administraciones públicas",
      "Profesionales",
    ]) {
      expect(screen.getByRole("heading", { level: 3, name })).toBeInTheDocument();
    }
  });

  it("sin sesión ofrece entrar al panel desde la cabecera", async () => {
    getServerSessionMock.mockResolvedValue(null);

    render(await Home());

    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });

  it("la llamada de contacto es un mailto al correo por defecto, con su asunto", async () => {
    getServerSessionMock.mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", undefined);

    render(await Home());

    expect(screen.getByRole("link", { name: "Escríbenos" })).toHaveAttribute(
      "href",
      "mailto:hola@popyplan.com?subject=Consulta%20sobre%20Popyplan",
    );
    expect(screen.getByRole("link", { name: "Escríbenos para una asociación" })).toHaveAttribute(
      "href",
      "mailto:hola@popyplan.com?subject=Popyplan%20para%20una%20asociaci%C3%B3n",
    );
  });

  it("sin tiendas configuradas la landing no pinta botones de tienda", async () => {
    getServerSessionMock.mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", undefined);

    render(await Home());

    expect(screen.queryByRole("link", { name: "Descargar en el App Store" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Descargar en Google Play" })).toBeNull();
  });

  it("generateMetadata describe la landing con su Open Graph", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://popyplan.com");

    const metadata = await generateMetadata();

    expect(metadata.title).toEqual({
      absolute: "Popyplan — planes, comunidades y actividades",
    });
    expect(metadata.description).toBe(
      "Popyplan es la app de planes, comunidades y actividades, con un panel para asociaciones, administraciones públicas y profesionales.",
    );
    expect(metadata.openGraph).toMatchObject({
      title: "Popyplan — planes, comunidades y actividades",
      url: "https://popyplan.com",
      siteName: "Popyplan",
      images: ["/og.png"],
      locale: "es_ES",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });
```

- [ ] **Step 2: Ejecutar los tests para comprobar que fallan**

Run: `npx vitest run app/page.test.tsx`
Expected: FAIL — los tests de la landing fallan con el `NextRedirectSignal` de `/login` (la página sigue redirigiendo sin sesión) y el de metadatos con `generateMetadata is not a function`.

- [ ] **Step 3: Añadir las claves de catálogo (los cuatro idiomas)**

Dentro del nodo `"landing"` que creó la Tarea 3, añadir los siete bloques nuevos (deja `stores` y `appAccount` donde están; el orden dentro del nodo debe ser el mismo en los cuatro ficheros: `meta`, `header`, `hero`, `stores`, `audiences`, `how`, `privacy`, `contact`, `appAccount`).

`messages/en.json`:

```json
    "meta": {
      "title": "Popyplan — plans, communities and activities",
      "description": "Popyplan is the app for plans, communities and activities, with a panel for associations, public administrations and professionals."
    },
    "header": {
      "brand": "Popyplan",
      "login": "Log in"
    },
    "hero": {
      "title": "Plans, communities and activities for living well, together",
      "subtitle": "Popyplan brings together what you do with other people: open activities, communities with their own rules, and a panel for whoever organises them.",
      "ctaPanel": "Go to the panel"
    },
    "audiences": {
      "title": "Who it is for",
      "people": {
        "title": "People",
        "benefits": [
          "Activities and plans near you, with sign-up from the app.",
          "Communities with their own rules: open, on request or private.",
          "A support network, if you want one: you decide who is in it."
        ],
        "cta": "Get it on your phone"
      },
      "associations": {
        "title": "Associations and NGOs",
        "benefits": [
          "People, activities and attendance with QR check-in.",
          "Announcements, a resource library and anonymous surveys.",
          "Programmes with a declared budget and a final report."
        ],
        "cta": "Write to us about an association"
      },
      "administrations": {
        "title": "Public administrations",
        "benefits": [
          "An observatory of the territory you declare, including places with no activity yet.",
          "The funded network: what the entities you support are doing.",
          "Comparisons between periods and reports in CSV and PDF."
        ],
        "cta": "Write to us about a public administration"
      },
      "professionals": {
        "title": "Professionals",
        "benefits": [
          "Private communities for the people you work with.",
          "Your own materials in the library, by audience.",
          "Never clinical data: Popyplan is not a medical record."
        ],
        "cta": "Write to us about professional use"
      }
    },
    "how": {
      "title": "How it works",
      "steps": [
        "The entity invites people into its space; nobody creates an account for somebody else.",
        "Each activity is published, filled and checked in with the QR code in the app.",
        "The panel sums up what happened, aggregated and ready for a report."
      ]
    },
    "privacy": {
      "title": "Privacy by design",
      "items": [
        "The panel never shows participants' phone numbers or email addresses.",
        "Popyplan stores no clinical data and no diagnoses.",
        "Surveys are anonymous and are only ever shown aggregated.",
        "No count of people is shown below five.",
        "Nobody declares themselves a relative of anybody: the spaces are separate.",
        "Everything in Spanish, Basque and Catalan."
      ]
    },
    "contact": {
      "title": "Talk to us",
      "body": "Tell us what your organisation does and we will walk you through the panel.",
      "cta": "Write to us",
      "subject": {
        "associations": "Popyplan for an association",
        "administrations": "Popyplan for a public administration",
        "professionals": "Popyplan for professionals",
        "other": "Question about Popyplan"
      }
    },
```

`messages/es.json`:

```json
    "meta": {
      "title": "Popyplan — planes, comunidades y actividades",
      "description": "Popyplan es la app de planes, comunidades y actividades, con un panel para asociaciones, administraciones públicas y profesionales."
    },
    "header": {
      "brand": "Popyplan",
      "login": "Entrar"
    },
    "hero": {
      "title": "Planes, comunidades y actividades para vivir bien acompañado",
      "subtitle": "Popyplan reúne en un mismo sitio lo que haces con otras personas: actividades abiertas, comunidades con sus normas y un panel para quien las organiza.",
      "ctaPanel": "Entrar al panel"
    },
    "audiences": {
      "title": "Para quién es",
      "people": {
        "title": "Personas",
        "benefits": [
          "Actividades y planes cerca de ti, con inscripción desde la app.",
          "Comunidades con sus normas: abiertas, con solicitud o privadas.",
          "Tu red de apoyo, si quieres tenerla: tú decides quién la forma."
        ],
        "cta": "Descárgala en tu móvil"
      },
      "associations": {
        "title": "Asociaciones y ONG",
        "benefits": [
          "Personas, actividades y asistencia con check-in por QR.",
          "Comunicaciones, biblioteca de recursos y encuestas anónimas.",
          "Programas con presupuesto declarado e informe final."
        ],
        "cta": "Escríbenos para una asociación"
      },
      "administrations": {
        "title": "Administraciones públicas",
        "benefits": [
          "Observatorio del territorio que declaras, también donde todavía no hay actividad.",
          "Red financiada: qué hacen las entidades a las que apoyas.",
          "Comparativas entre periodos e informes en CSV y PDF."
        ],
        "cta": "Escríbenos para una administración"
      },
      "professionals": {
        "title": "Profesionales",
        "benefits": [
          "Comunidades privadas para las personas con las que trabajas.",
          "Tus propios materiales en la biblioteca, por audiencia.",
          "Nunca datos clínicos: Popyplan no es una historia clínica."
        ],
        "cta": "Escríbenos para un uso profesional"
      }
    },
    "how": {
      "title": "Cómo funciona",
      "steps": [
        "La entidad invita a las personas a su espacio; nadie crea la cuenta de nadie.",
        "Cada actividad se publica, se llena y se pasa lista con el QR de la app.",
        "El panel resume lo que ha pasado, en agregado y listo para un informe."
      ]
    },
    "privacy": {
      "title": "Privacidad por diseño",
      "items": [
        "El panel no muestra teléfonos ni correos de las personas participantes.",
        "Popyplan no guarda datos clínicos ni diagnósticos.",
        "Las encuestas son anónimas y solo se ven agregadas.",
        "Ningún recuento de personas se muestra por debajo de cinco.",
        "Nadie declara ser familiar de nadie: los espacios están separados.",
        "Todo en español, euskera y catalán."
      ]
    },
    "contact": {
      "title": "Habla con nosotros",
      "body": "Cuéntanos qué hace tu entidad y te enseñamos el panel.",
      "cta": "Escríbenos",
      "subject": {
        "associations": "Popyplan para una asociación",
        "administrations": "Popyplan para una administración pública",
        "professionals": "Popyplan para profesionales",
        "other": "Consulta sobre Popyplan"
      }
    },
```

`messages/eu.json`:

```json
    "meta": {
      "title": "Popyplan — planak, komunitateak eta jarduerak",
      "description": "Popyplan planen, komunitateen eta jardueren aplikazioa da, elkarte, administrazio publiko eta profesionalentzako panel batekin."
    },
    "header": {
      "brand": "Popyplan",
      "login": "Sartu"
    },
    "hero": {
      "title": "Planak, komunitateak eta jarduerak, ondo eta lagunduta bizitzeko",
      "subtitle": "Popyplanek leku bakarrean biltzen du beste pertsonekin egiten duzuna: jarduera irekiak, arau propioak dituzten komunitateak eta antolatzen dituenarentzako panel bat.",
      "ctaPanel": "Panelera sartu"
    },
    "audiences": {
      "title": "Norentzat da",
      "people": {
        "title": "Pertsonak",
        "benefits": [
          "Zure inguruko jarduerak eta planak, aplikaziotik izena emanda.",
          "Arau propioak dituzten komunitateak: irekiak, eskaeraz edo pribatuak.",
          "Zure laguntza-sarea, nahi baduzu: zuk erabakitzen duzu nork osatzen duen."
        ],
        "cta": "Deskargatu mugikorrean"
      },
      "associations": {
        "title": "Elkarteak eta GKEak",
        "benefits": [
          "Pertsonak, jarduerak eta bertaratzea, QR bidezko check-inarekin.",
          "Komunikazioak, baliabide-liburutegia eta inkesta anonimoak.",
          "Aurrekontu adierazia eta amaierako txostena dituzten programak."
        ],
        "cta": "Idatzi iezaguzu elkarte batentzat"
      },
      "administrations": {
        "title": "Administrazio publikoak",
        "benefits": [
          "Adierazten duzun lurraldearen behatokia, oraindik jarduerarik ez dagoen tokietan ere.",
          "Finantzatutako sarea: laguntzen dituzun erakundeek zer egiten duten.",
          "Aldien arteko konparaketak eta txostenak CSV eta PDF formatuan."
        ],
        "cta": "Idatzi iezaguzu administrazio batentzat"
      },
      "professionals": {
        "title": "Profesionalak",
        "benefits": [
          "Komunitate pribatuak zurekin lan egiten duten pertsonentzat.",
          "Zure material propioak liburutegian, hartzailearen arabera.",
          "Inoiz ez datu klinikorik: Popyplan ez da historia kliniko bat."
        ],
        "cta": "Idatzi iezaguzu erabilera profesionalerako"
      }
    },
    "how": {
      "title": "Nola funtzionatzen duen",
      "steps": [
        "Erakundeak pertsonak gonbidatzen ditu bere gunera; inork ez du besteren konturik sortzen.",
        "Jarduera bakoitza argitaratu, bete eta aplikazioko QR kodearekin pasatzen da zerrenda.",
        "Panelak gertatutakoa laburbiltzen du, modu agregatuan eta txosten baterako prest."
      ]
    },
    "privacy": {
      "title": "Pribatutasuna diseinutik",
      "items": [
        "Panelak ez du parte-hartzaileen telefonorik ez helbide elektronikorik erakusten.",
        "Popyplanek ez du datu klinikorik ez diagnostikorik gordetzen.",
        "Inkestak anonimoak dira eta beti modu agregatuan ikusten dira.",
        "Ez da bostetik beherako pertsona-zenbaketarik erakusten.",
        "Inork ez du besteren senide dela adierazten: guneak bereizita daude.",
        "Dena gaztelaniaz, euskaraz eta katalanez."
      ]
    },
    "contact": {
      "title": "Hitz egin gurekin",
      "body": "Esaguzu zure erakundeak zer egiten duen eta panela erakutsiko dizugu.",
      "cta": "Idatzi iezaguzu",
      "subject": {
        "associations": "Popyplan elkarte batentzat",
        "administrations": "Popyplan administrazio publiko batentzat",
        "professionals": "Popyplan profesionalentzat",
        "other": "Popyplani buruzko galdera"
      }
    },
```

`messages/ca.json`:

```json
    "meta": {
      "title": "Popyplan — plans, comunitats i activitats",
      "description": "Popyplan és l'aplicació de plans, comunitats i activitats, amb un panell per a associacions, administracions públiques i professionals."
    },
    "header": {
      "brand": "Popyplan",
      "login": "Entra"
    },
    "hero": {
      "title": "Plans, comunitats i activitats per viure bé acompanyat",
      "subtitle": "Popyplan reuneix en un sol lloc allò que fas amb altres persones: activitats obertes, comunitats amb les seves normes i un panell per a qui les organitza.",
      "ctaPanel": "Entra al panell"
    },
    "audiences": {
      "title": "Per a qui és",
      "people": {
        "title": "Persones",
        "benefits": [
          "Activitats i plans a prop teu, amb inscripció des de l'aplicació.",
          "Comunitats amb les seves normes: obertes, amb sol·licitud o privades.",
          "La teva xarxa de suport, si en vols una: tu decideixes qui en forma part."
        ],
        "cta": "Descarrega-te-la al mòbil"
      },
      "associations": {
        "title": "Associacions i ONG",
        "benefits": [
          "Persones, activitats i assistència amb registre per codi QR.",
          "Comunicacions, biblioteca de recursos i enquestes anònimes.",
          "Programes amb pressupost declarat i informe final."
        ],
        "cta": "Escriu-nos per a una associació"
      },
      "administrations": {
        "title": "Administracions públiques",
        "benefits": [
          "Observatori del territori que declares, també on encara no hi ha activitat.",
          "Xarxa finançada: què fan les entitats que finances.",
          "Comparatives entre períodes i informes en CSV i PDF."
        ],
        "cta": "Escriu-nos per a una administració"
      },
      "professionals": {
        "title": "Professionals",
        "benefits": [
          "Comunitats privades per a les persones amb qui treballes.",
          "Els teus materials a la biblioteca, per audiència.",
          "Mai dades clíniques: Popyplan no és una història clínica."
        ],
        "cta": "Escriu-nos per a un ús professional"
      }
    },
    "how": {
      "title": "Com funciona",
      "steps": [
        "L'entitat convida les persones al seu espai; ningú crea el compte de ningú.",
        "Cada activitat es publica, s'omple i es passa llista amb el QR de l'aplicació.",
        "El panell resumeix què ha passat, en agregat i a punt per a un informe."
      ]
    },
    "privacy": {
      "title": "Privadesa per disseny",
      "items": [
        "El panell no mostra telèfons ni correus de les persones participants.",
        "Popyplan no desa dades clíniques ni diagnòstics.",
        "Les enquestes són anònimes i només es veuen agregades.",
        "No es mostra cap recompte de persones per sota de cinc.",
        "Ningú declara ser familiar de ningú: els espais estan separats.",
        "Tot en castellà, èuscar i català."
      ]
    },
    "contact": {
      "title": "Parla amb nosaltres",
      "body": "Explica'ns què fa la teva entitat i et mostrem el panell.",
      "cta": "Escriu-nos",
      "subject": {
        "associations": "Popyplan per a una associació",
        "administrations": "Popyplan per a una administració pública",
        "professionals": "Popyplan per a professionals",
        "other": "Consulta sobre Popyplan"
      }
    },
```

- [ ] **Step 4: Implementar los componentes de la landing**

`components/landing/mailto.ts`:

```ts
/**
 * `mailto:` con asunto para las llamadas de la web pública (spec de
 * diseño `2026-09-20-landing-login-unico-design.md` §2, decisión 5: un
 * correo ahora, un formulario guardado en plataforma en la fase de alta
 * desde la web).
 *
 * El asunto va por `encodeURIComponent`: es texto traducido y lleva
 * espacios, tildes y comillas según el idioma — sin codificar, el cliente
 * de correo corta el asunto en el primer carácter raro.
 */
export function mailtoHref(email: string, subject: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
```

`components/landing/LandingHeader.tsx`:

```tsx
import Link from "next/link";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

import { SECONDARY_LINK_CLASS } from "./linkStyles";

/**
 * Cabecera de la web pública: marca, selector de idioma y «Entrar».
 *
 * La marca va en un `<p>`, no en un encabezado: el único `<h1>` de la
 * página es el titular de la portada (`Hero`), y un `<h1>` con la marca
 * dejaría dos primeros niveles compitiendo en el mismo documento.
 */
export function LandingHeader() {
  const t = useTranslations("landing.header");

  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2">
        <p className="text-base font-semibold text-text-base">{t("brand")}</p>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link href="/login" className={SECONDARY_LINK_CLASS}>
            {t("login")}
          </Link>
        </div>
      </div>
    </header>
  );
}
```

`components/landing/Hero.tsx`:

```tsx
import Link from "next/link";
import { useTranslations } from "next-intl";

import { PRIMARY_LINK_CLASS } from "./linkStyles";
import { StoreLinks } from "./StoreLinks";

/**
 * Portada (spec §4, bloque 2). Fondo `primary-100`: es una superficie
 * decorativa, así que puede usar el tono de marca claro — el texto
 * encima sigue siendo `text-base`, par ya auditado en
 * `lib/a11y/tokens.test.ts` (16,93:1).
 */
export function Hero() {
  const t = useTranslations("landing.hero");

  return (
    <section className="bg-primary-100">
      <div className="mx-auto max-w-5xl px-4 py-16">
        <h1 className="mb-3 max-w-3xl text-xl font-semibold text-text-base">{t("title")}</h1>
        <p className="mb-6 max-w-2xl text-sm text-text-secondary">{t("subtitle")}</p>
        <div className="flex flex-wrap items-end gap-3">
          <Link href="/login" className={PRIMARY_LINK_CLASS}>
            {t("ctaPanel")}
          </Link>
          <StoreLinks />
        </div>
      </div>
    </section>
  );
}
```

`components/landing/Audiences.tsx`:

```tsx
import { useTranslations } from "next-intl";

import { contactEmail } from "@/lib/config/site";

import { SECONDARY_LINK_CLASS } from "./linkStyles";
import { mailtoHref } from "./mailto";
import { StoreLinks } from "./StoreLinks";

/**
 * «Para quién es» (spec §4, bloque 3): cuatro tarjetas con 2-3 beneficios
 * y su llamada. Los beneficios salen de lo que el producto hace hoy, sin
 * ninguna cifra ni cliente inventados.
 *
 * Las claves se enumeran en un array **literal** (`AUDIENCES`), no
 * construidas por concatenación: es el mapa explícito que permite la
 * convención de i18n de este repo («nunca claves dinámicas salvo un mapa
 * con todas las variantes»).
 *
 * La tarjeta de personas no lleva `mailto:`: su llamada son los botones
 * de tienda, que desaparecen enteros (etiqueta incluida) si todavía no
 * hay ficha publicada. Las otras tres usan como asunto la clave de
 * `landing.contact.subject` que se llama igual que el propio público
 * (`associations`/`administrations`/`professionals`), a la que TypeScript
 * llega solo: dentro del `else` del ternario, `audience` ya está
 * estrechada a esas tres.
 */
const AUDIENCES = ["people", "associations", "administrations", "professionals"] as const;

export function Audiences() {
  const t = useTranslations("landing.audiences");
  const tSubject = useTranslations("landing.contact.subject");
  const email = contactEmail();

  return (
    <section aria-labelledby="landing-audiences" className="mx-auto max-w-5xl px-4 py-12">
      <h2 id="landing-audiences" className="mb-4 text-lg font-semibold text-text-base">
        {t("title")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {AUDIENCES.map((audience) => {
          // `t.raw` devuelve el array del catálogo tal cual (sin formateo
          // ICU: ninguno de estos beneficios lleva parámetros), mismo uso
          // que `components/help/PageHelp.tsx`.
          const benefits = t.raw(`${audience}.benefits`) as string[];

          return (
            <article key={audience} className="rounded-lg border border-border bg-white p-3">
              <h3 className="mb-2 text-base font-semibold text-text-base">
                {t(`${audience}.title`)}
              </h3>
              <ul className="mb-3 flex list-disc flex-col gap-1 pl-4 text-sm text-text-secondary">
                {benefits.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
              {audience === "people" ? (
                <StoreLinks label={t("people.cta")} />
              ) : (
                <a href={mailtoHref(email, tSubject(audience))} className={SECONDARY_LINK_CLASS}>
                  {t(`${audience}.cta`)}
                </a>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
```

`components/landing/HowItWorks.tsx`:

```tsx
import { useTranslations } from "next-intl";

/** «Cómo funciona» (spec §4, bloque 4): tres pasos, en orden. */
export function HowItWorks() {
  const t = useTranslations("landing.how");
  const steps = t.raw("steps") as string[];

  return (
    <section aria-labelledby="landing-how" className="bg-white">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <h2 id="landing-how" className="mb-4 text-lg font-semibold text-text-base">
          {t("title")}
        </h2>
        <ol className="flex list-decimal flex-col gap-2 pl-4 text-sm text-text-secondary">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
```

`components/landing/Privacy.tsx`:

```tsx
import { useTranslations } from "next-intl";

/**
 * «Privacidad por diseño» (spec §4, bloque 5): los compromisos que el
 * sistema **ya** cumple (invariantes 1 y 9, umbral de agregación de 5,
 * encuestas anónimas, tres idiomas). Ninguna promesa que el código no
 * respalde.
 */
export function Privacy() {
  const t = useTranslations("landing.privacy");
  const items = t.raw("items") as string[];

  return (
    <section aria-labelledby="landing-privacy" className="mx-auto max-w-5xl px-4 py-12">
      <h2 id="landing-privacy" className="mb-4 text-lg font-semibold text-text-base">
        {t("title")}
      </h2>
      <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-text-secondary">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
```

`components/landing/Contact.tsx`:

```tsx
import { useTranslations } from "next-intl";

import { contactEmail } from "@/lib/config/site";

import { PRIMARY_LINK_CLASS } from "./linkStyles";
import { mailtoHref } from "./mailto";

/**
 * «Habla con nosotros» (spec §4, bloque 6, y decisión 5): un `mailto:`
 * con asunto genérico. Las tres llamadas por público viven en sus propias
 * tarjetas (`Audiences.tsx`), cada una con su asunto.
 */
export function Contact() {
  const t = useTranslations("landing.contact");

  return (
    <section aria-labelledby="landing-contact" className="bg-white">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <h2 id="landing-contact" className="mb-2 text-lg font-semibold text-text-base">
          {t("title")}
        </h2>
        <p className="mb-4 max-w-2xl text-sm text-text-secondary">{t("body")}</p>
        <a href={mailtoHref(contactEmail(), t("subject.other"))} className={PRIMARY_LINK_CLASS}>
          {t("cta")}
        </a>
      </div>
    </section>
  );
}
```

`components/landing/Landing.tsx`:

```tsx
import { Footer } from "@/components/layout/Footer";

import { Audiences } from "./Audiences";
import { Contact } from "./Contact";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { LandingHeader } from "./LandingHeader";
import { Privacy } from "./Privacy";

/**
 * Web pública de presentación (spec de diseño
 * `2026-09-20-landing-login-unico-design.md` §3.3 y §4): una sola página
 * por bloques, en este orden. Sin botón «?» de ayuda: está fuera de las
 * tres áreas del panel (decisión 3 de «ayuda por pantalla»).
 *
 * Orden de encabezados: `h1` (portada) → `h2` (sección) → `h3` (tarjeta
 * de público), sin saltos — `axe` lo comprueba en `app/page.test.tsx`.
 */
export function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-border-light">
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <Audiences />
        <HowItWorks />
        <Privacy />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 5: Conectar la landing y los metadatos en `app/page.tsx`**

Sustituir el fichero entero por:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { AppAccountScreen } from "@/components/landing/AppAccountScreen";
import { Landing } from "@/components/landing/Landing";
import { resolveArea } from "@/lib/auth/area";
import { getServerSession } from "@/lib/auth/session";
import { siteUrl } from "@/lib/config/site";
import { DEFAULT_LANGUAGE, isSupportedLanguage } from "@/lib/i18n/languages";
import { localeFor } from "@/lib/i18n/locale";

/**
 * Metadatos de la web pública (spec §6). `title.absolute` y no una cadena
 * a secas: el layout raíz aplica la plantilla `"%s · Popyplan"` a todo
 * título de página, y aquí el título ya lleva la marca — sin `absolute`
 * saldría «Popyplan — planes… · Popyplan».
 *
 * `openGraph.locale` va en la forma `idioma_TERRITORIO` que pide el
 * protocolo (`es_ES`), derivada del mismo mapa que usa el resto del panel
 * (`lib/i18n/locale.ts`), no de una tabla nueva.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.meta");
  const locale = await getLocale();
  const language = isSupportedLanguage(locale) ? locale : DEFAULT_LANGUAGE;
  const title = t("title");
  const description = t("description");
  const url = siteUrl();

  return {
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Popyplan",
      images: ["/og.png"],
      locale: localeFor(language).replace("-", "_"),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
  };
}

/**
 * Raíz pública: la web de presentación y, con sesión, el reparto por área
 * (spec de diseño `2026-09-20-landing-login-unico-design.md` §3.1).
 *
 * - **Sin sesión** pinta `<Landing />`. Ya no redirige a `/login`: el
 *   enfoque aprobado (enfoque 1 de la spec) es que la raíz siga
 *   resolviendo la sesión y, cuando no la hay, enseñe la web — mover el
 *   resolutor a `/entrar` obligaba a tocar los cinco `redirect("/")` del
 *   panel y el `returnTo` del login por una ventaja marginal.
 * - **Con sesión** redirige al área que resuelve `resolveArea`, igual que
 *   siempre.
 * - **Con sesión y `sin-acceso`** pinta `<AppAccountScreen />` (§5): la
 *   cuenta es válida, su sitio es la app.
 *
 * Depende del middleware: `getServerSession()` solo lee la cabecera
 * interna `x-pp-access-token` que pone `middleware.ts` tras refrescar la
 * cookie, así que esta ruta **tiene que estar en su `matcher`** (hallazgo
 * A2) — y desde la landing, ese middleware deja pasar la raíz sin sesión
 * en vez de mandarla al login (§3.2).
 */
export default async function Home() {
  const session = await getServerSession();
  if (!session) {
    return <Landing />;
  }

  const area = resolveArea(session.me, session.platformRole);

  if (area === "plataforma") {
    redirect("/plataforma");
  }
  if (area !== "sin-acceso") {
    if (area.kind === "entidad") redirect(`/entidad/${area.slug}`);
    if (area.kind === "paraguas") redirect(`/paraguas/${area.slug}`);
    redirect("/elegir-entidad");
  }

  return <AppAccountScreen />;
}
```

- [ ] **Step 6: Ejecutar los tests para comprobar que pasan**

Run: `npx vitest run app/page.test.tsx lib/i18n/messages.test.ts`
Expected: PASS — landing, tarjetas, `mailto:`, tiendas ocultas, `axe`, metadatos, los cinco redirects que quedan y la paridad de los cuatro catálogos.

- [ ] **Step 7: Comprobar que el build real compila la landing**

Run: `npm run build`
Expected: build correcto, con `/` listada como ruta dinámica (`ƒ`) — lo es desde i18n, porque `i18n/request.ts` lee `cookies()`/`headers()`.

- [ ] **Step 8: Verificación completa**

Run: `npm run typecheck && npm run lint && npx vitest run app/page.test.tsx lib/i18n/messages.test.ts`
Expected: todo en verde, sin avisos de `react/jsx-no-literals` ni de `no-restricted-syntax`.

- [ ] **Step 9: Commit**

```bash
git add components/landing app/page.tsx app/page.test.tsx messages
git commit -m "$(cat <<'EOF'
feat(landing): web pública de presentación en la raíz

Sin sesión, `/` pinta la landing (portada, cuatro públicos, cómo funciona,
privacidad y contacto por mailto) en vez de redirigir al login; con sesión
sigue repartiendo por área. Metadatos con Open Graph y Twitter Card.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: robots, sitemap y Open Graph

**Files:**
- Create: `app/robots.ts`
- Create: `app/robots.test.ts`
- Create: `app/sitemap.ts`
- Create: `app/sitemap.test.ts`
- Create: `public/og.png` (generada con un script único que **no** se commitea)

**Interfaces:**
- Consumes: `siteUrl()` de `lib/config/site.ts` (Tarea 1); `openGraph.images: ["/og.png"]` de `app/page.tsx` (Tarea 4).
- Produces: `/robots.txt` y `/sitemap.xml` servidos por Next (`MetadataRoute.Robots` / `MetadataRoute.Sitemap`), y el fichero `public/og.png` de 1200×630.

> **Los dos ficheros son `.ts` bajo `app/`, así que entran en `coverage.include`** (`app/**/*.ts`): sin test propio bajarían el porcentaje por debajo del umbral de 99,7.

- [ ] **Step 1: Escribir los tests que fallan**

`app/robots.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import robots from "./robots";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("robots", () => {
  it("permite la web pública y prohíbe todo el panel", () => {
    const { rules } = robots();
    const rule = Array.isArray(rules) ? rules[0] : rules;

    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toEqual(["/", "/accesibilidad"]);
    expect(rule.disallow).toEqual([
      "/entidad",
      "/paraguas",
      "/plataforma",
      "/elegir-entidad",
      "/login",
      "/api",
    ]);
  });

  it("apunta el sitemap a la URL configurada del sitio", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://popyplan.com");

    expect(robots().sitemap).toBe("https://popyplan.com/sitemap.xml");
  });

  it("sin la variable del sitio cae al panel local", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);

    expect(robots().sitemap).toBe("http://localhost:3100/sitemap.xml");
  });
});
```

`app/sitemap.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import sitemap from "./sitemap";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sitemap", () => {
  it("lista solo las dos rutas públicas, con la URL configurada del sitio", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://popyplan.com");

    expect(sitemap()).toEqual([
      { url: "https://popyplan.com/", changeFrequency: "monthly", priority: 1 },
      { url: "https://popyplan.com/accesibilidad", changeFrequency: "yearly", priority: 0.3 },
    ]);
  });

  it("sin la variable del sitio cae al panel local", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);

    expect(sitemap().map((entry) => entry.url)).toEqual([
      "http://localhost:3100/",
      "http://localhost:3100/accesibilidad",
    ]);
  });
});
```

- [ ] **Step 2: Ejecutar los tests para comprobar que fallan**

Run: `npx vitest run app/robots.test.ts app/sitemap.test.ts`
Expected: FAIL — `Failed to resolve import "./robots"` y `"./sitemap"`.

- [ ] **Step 3: Implementar las dos rutas de metadatos**

`app/robots.ts`:

```ts
import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/config/site";

/**
 * `/robots.txt` (spec de diseño
 * `2026-09-20-landing-login-unico-design.md` §6).
 *
 * Solo la web pública y la declaración de accesibilidad son indexables.
 * Todo el panel queda fuera: sus rutas exigen sesión y devolverían una
 * redirección al login a cualquier rastreador, que es ruido puro en un
 * índice de búsqueda. `/login` tampoco se indexa (no aporta nada a quien
 * busca) ni `/api` (route handlers de sesión e idioma).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/accesibilidad"],
        disallow: ["/entidad", "/paraguas", "/plataforma", "/elegir-entidad", "/login", "/api"],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
```

`app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/config/site";

/**
 * `/sitemap.xml` (spec §6): las dos únicas rutas públicas del panel.
 *
 * Sin `lastModified` a propósito: no hay ninguna fecha real de
 * publicación que dar (el contenido son textos de catálogo, que cambian
 * con cada despliegue), y poner `new Date()` haría que el sitemap
 * afirmara que todo se modificó justo ahora en cada petición — además de
 * dejar el test sin nada estable que comprobar.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();

  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/accesibilidad`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
```

- [ ] **Step 4: Ejecutar los tests para comprobar que pasan**

Run: `npx vitest run app/robots.test.ts app/sitemap.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Generar `public/og.png` con un script único**

Ninguna dependencia instalada sabe rasterizar texto (`package.json` no
tiene `sharp`, `canvas`, `satori` ni `resvg`), y añadir una solo para
esto no está en el alcance: se genera un PNG liso del color de marca
`#0e7c78` (`--color-primary-700`), que es exactamente lo que la spec deja
como provisional («se sustituye cuando haya material de marca»). El
script es de un solo uso y **no se commitea**.

Crear `/tmp/og-popyplan.mjs` (fuera del repo, así no hay nada que ignorar
ni que borrar del árbol):

```js
/**
 * Genera public/og.png (1200x630) relleno del color de marca
 * --color-primary-700 (#0e7c78), con solo módulos de Node.
 * Uso: node /tmp/og-popyplan.mjs  (desde la raíz del worktree)
 */
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const WIDTH = 1200;
const HEIGHT = 630;
const [R, G, B] = [0x0e, 0x7c, 0x78];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8; // profundidad de bit
ihdr[9] = 2; // color truecolor RGB
// bytes 10-12 (compresión, filtro, entrelazado) se quedan a 0

const row = Buffer.alloc(1 + WIDTH * 3); // el primer byte es el filtro (0 = None)
for (let x = 0; x < WIDTH; x += 1) {
  row[1 + x * 3] = R;
  row[2 + x * 3] = G;
  row[3 + x * 3] = B;
}
const raw = Buffer.concat(Array.from({ length: HEIGHT }, () => row));

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync("public/og.png", png);
console.log(`public/og.png: ${png.length} bytes, ${WIDTH}x${HEIGHT}`);
```

Run: `node /tmp/og-popyplan.mjs`
Expected: `public/og.png: <unos pocos KB> bytes, 1200x630`.

- [ ] **Step 6: Comprobar que el PNG es válido y tiene el tamaño pedido**

```bash
node -e "const b=require('node:fs').readFileSync('public/og.png');console.log(b.subarray(1,4).toString('ascii'), b.readUInt32BE(16)+'x'+b.readUInt32BE(20));"
```
Expected: `PNG 1200x630`.

- [ ] **Step 7: Verificación completa**

Run: `npm run typecheck && npm run lint && npx vitest run app/robots.test.ts app/sitemap.test.ts && npm run build`
Expected: todo en verde; el build lista `/robots.txt` y `/sitemap.xml` entre las rutas generadas.

- [ ] **Step 8: Commit**

```bash
git add app/robots.ts app/robots.test.ts app/sitemap.ts app/sitemap.test.ts public/og.png
git commit -m "$(cat <<'EOF'
feat(seo): robots, sitemap e imagen de compartir de la landing

robots.txt permite solo `/` y `/accesibilidad` y deja fuera las tres áreas
del panel, el login y `/api`; el sitemap lista esas dos rutas con la URL
configurada del sitio. `public/og.png` es un liso del color de marca, a
sustituir cuando haya material gráfico.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: E2E y documentación

**Files:**
- Create: `e2e/landing.spec.ts`
- Modify: `CLAUDE.md` (sección nueva + bullet de cobertura)
- Modify: `AGENTS.md` (mismos dos cambios; los dos ficheros son idénticos salvo su línea de cabecera)

**Interfaces:**
- Consumes: todo lo anterior (landing en `/`, `AppAccountScreen`, middleware con la raíz pública).
- Produces: el spec de Playwright de la spec §7 y la documentación de la rama.

> **Antes de ejecutar los e2e** hace falta un backend local sembrado
> (`seed_panel_demo`) en `http://localhost:8001`. Sin él, `npm run e2e`
> falla en el login: en ese caso, completa los pasos de documentación,
> deja el spec escrito y anota en el commit que los e2e quedan pendientes
> de correr contra el backend (el job `e2e` de CI los ejecuta igual).
> **Ojo al límite de 5 logins por minuto y por IP**: este spec hace dos
> logins de UI y ninguno de API.

- [ ] **Step 1: Escribir el spec de e2e**

Crear `e2e/landing.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

import { BIDASOA_SLUG, DEMO_PASSWORD, DEMO_PERSON_EMAIL, TITULAR_BIDASOA_EMAIL } from "./helpers";

/**
 * Landing pública y login único (spec de diseño
 * `2026-09-20-landing-login-unico-design.md` §7), contra el backend real
 * sembrado con `seed_panel_demo`.
 *
 * Dos logins de UI en todo el fichero (límite de 5/60 s por IP en local,
 * `users/rate_limiting.py`; `pop.settings_e2e` lo desactiva en CI) y
 * ninguno de API: la navegación es toda por clic.
 *
 * `DEMO_PERSON_EMAIL` (`panel-demo-asociacion-bidasoa-p01@test.com`) es
 * una de las veinte personas «de calle» de la demo: participa en
 * actividades de Bidasoa, pero ninguno de los cinco roles con panel
 * (`lib/auth/area.ts::ENTIDAD_PANEL_ROLES`) es el suyo, así que
 * `resolveArea` la resuelve a `sin-acceso` — es justo la cuenta que tiene
 * que ver «Tu cuenta es de la app».
 *
 * `exact: true` en el enlace «Entrar» de la landing: el `name` de
 * `getByRole` de Playwright empareja por subcadena por defecto, y la
 * portada tiene además «Entrar al panel» — sin `exact` serían dos
 * coincidencias y el modo estricto lo rechazaría.
 */
test("sin sesión, la raíz muestra la landing y «Entrar» lleva al login", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Planes, comunidades y actividades para vivir bien acompañado",
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Asociaciones y ONG" })).toBeVisible();

  await page.getByRole("link", { name: "Entrar", exact: true }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("una cuenta sin rol de panel ve «Tu cuenta es de la app»", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Usuario o email").fill(DEMO_PERSON_EMAIL);
  await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Tu cuenta es de la app Popyplan" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
});

test("con sesión de titular, visitar la raíz aterriza en su entidad", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Usuario o email").fill(TITULAR_BIDASOA_EMAIL);
  await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(new RegExp(`/entidad/${BIDASOA_SLUG}`));

  // La raíz ya no es una pantalla de paso: con sesión reparte por área,
  // igual que antes de la landing (hallazgo A2).
  await page.goto("/");

  await expect(page).toHaveURL(new RegExp(`/entidad/${BIDASOA_SLUG}`));
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
});
```

- [ ] **Step 2: Ejecutar el spec contra el backend real**

Run: `npm run e2e -- landing.spec.ts`
Expected: 3 tests en verde (Playwright levanta `next dev --port 3100` solo, con `NEXT_PUBLIC_API_URL=http://localhost:8001`). Si el backend no está sembrado o responde 429, anótalo y sigue: el job `e2e` de CI lo ejecuta con `pop.settings_e2e`.

- [ ] **Step 3: Documentar la sección en `CLAUDE.md`**

Insertar esta sección **justo antes** de `## Comandos`:

```markdown
## Landing pública y login único (2026-09-20)

Spec de diseño: `docs/superpowers/specs/2026-09-20-landing-login-unico-design.md`
(encargo del propietario 2026-09-18: «una web de presentación… y que todo
el software tenga un mismo login»). Plan de 6 tareas:
`docs/superpowers/plans/2026-09-20-landing-login-unico.md`.

**`/` deja de redirigir al login.** `app/page.tsx` sigue siendo el
repartidor de áreas, pero con dos ramas de render más:

- **Sin sesión** → `<Landing />` (`components/landing/Landing.tsx`), la web
  pública. Enfoque 1 de la spec: se descartó mover el resolutor a `/entrar`
  porque obligaba a tocar los cinco `redirect("/")` del panel y el
  `returnTo` del login por una ventaja marginal.
- **Con sesión** → `resolveArea` como siempre (`/plataforma`,
  `/entidad/{slug}`, `/paraguas/{slug}`, `/elegir-entidad`).
- **Con sesión y `sin-acceso`** → `<AppAccountScreen />` («Tu cuenta es de
  la app Popyplan», spec §5), que sustituye al `ErrorState` «No tienes
  acceso a ningún área del panel». Las claves `pages.home.noAccess*` salen
  de los cuatro catálogos al quedarse sin consumidor.

**`middleware.ts`: la raíz sigue en el `matcher` pero ya no manda al
login.** Con cookie se refresca la sesión igual que siempre (hallazgo A2:
`getServerSession` solo lee la cabecera interna que pone el middleware, así
que sin esto el reparto por área no funciona); **sin** cookie o con el
refresh rechazado, `/` pasa por `passThroughWithoutAccess` en vez de
`redirectToLogin` — incluso en una navegación de documento. `isPublicRoot`
es la única condición nueva; `redirectToLogin` pierde su excepción
`pathname !== "/"` (la raíz ya nunca llega ahí) y guarda siempre el
`returnTo`. Ninguna otra ruta del `matcher` cambia.

**Componentes** (`components/landing/`, todos Server Components
**síncronos** que traducen con `useTranslations` de next-intl):
`Landing` compone `LandingHeader` (marca, `LanguageSwitcher` y «Entrar»),
`Hero` (portada, `<h1>`, fondo decorativo `primary-100`), `Audiences`
(cuatro tarjetas: personas, asociaciones, administraciones,
profesionales), `HowItWorks`, `Privacy`, `Contact` y el `Footer` común.
`StoreLinks` pinta los botones de tienda y devuelve `null` —etiqueta
incluida— si no hay ninguna URL configurada. `AppAccountScreen` reutiliza
`StoreLinks` y `LogoutButton`.
**Ninguno puede ser `async`**: Testing Library renderiza el árbol que
devuelve `app/page.tsx` con `react-dom/client`, que no resuelve promesas de
componente — por eso traducen con `useTranslations` (soportado en RSC) y no
con `getTranslations`, que solo usan `app/page.tsx` y su `generateMetadata`.

**Contenido y textos**: namespace `landing.*` en los cuatro catálogos
(`meta`, `header`, `hero`, `stores`, `audiences`, `how`, `privacy`,
`contact`, `appAccount`), con los arrays (`benefits`, `steps`, `items`)
leídos con `t.raw(...) as string[]`, mismo patrón que
`components/help/PageHelp.tsx`. Vocabulario neutro (la app es para gente
sana; la intervención es una capa opcional) y ninguna cifra ni cliente
inventados: los beneficios describen lo que el panel ya hace. El bloque de
privacidad enumera invariantes reales (sin teléfonos en el panel, sin datos
clínicos, encuestas anónimas y agregadas, umbral de 5, nadie declara ser
familiar de nadie, tres idiomas). Sin botón «?» de ayuda: está fuera de las
tres áreas (decisión 3 de «ayuda por pantalla»), y `lib/help/pageHelp.ts`
no lleva entrada de la raíz.

**Contacto**: `mailto:` (decisión 5 de la spec; el formulario guardado en
plataforma es de la fase de alta desde la web). `components/landing/
mailto.ts::mailtoHref` codifica el asunto con `encodeURIComponent` — es
texto traducido, con espacios y tildes. Cada tarjeta de público tiene su
asunto (`landing.contact.subject.*`) y el bloque «Habla con nosotros» usa
el genérico.

**Configuración** (`lib/config/site.ts`, mismo patrón de lectura que
`lib/api/baseUrl.ts`: `process.env` dentro de la función, nunca a nivel de
módulo): `siteUrl()` (`NEXT_PUBLIC_SITE_URL`, sin barra final, por defecto
`http://localhost:3100`), `contactEmail()` (`NEXT_PUBLIC_CONTACT_EMAIL`,
por defecto `hola@popyplan.com`) y `storeLinks()`
(`NEXT_PUBLIC_APP_STORE_URL`/`NEXT_PUBLIC_PLAY_STORE_URL`, vacías → `null`
→ botón no pintado). **A diferencia de `apiBaseUrl()`, no lanza en
producción**: sin `NEXT_PUBLIC_SITE_URL` la landing se pinta igual y lo
único que sale mal es el sitemap y las tarjetas de compartir. Las cuatro
son `NEXT_PUBLIC_*`, así que se incrustan **en el build**, no en runtime
(`.env.example` lo dice al lado de cada una).

**SEO** (spec §6): `app/robots.ts` permite `/` y `/accesibilidad` y
prohíbe `/entidad`, `/paraguas`, `/plataforma`, `/elegir-entidad`,
`/login` y `/api`; `app/sitemap.ts` lista las dos rutas públicas (sin
`lastModified`: no hay fecha real que dar). `app/page.tsx::generateMetadata`
usa `title.absolute` —el layout raíz aplica la plantilla `"%s · Popyplan"`
y el título ya lleva la marca— más `openGraph` (`images: ["/og.png"]`,
`url: siteUrl()`, `locale` en forma `es_ES` derivada de
`lib/i18n/locale.ts`) y `twitter.card = "summary_large_image"`.
`public/og.png` (1200×630) es hoy **un liso del color de marca**
(`#0e7c78`): ninguna dependencia instalada rasteriza texto y no se añadió
una solo para esto; se generó con un script de un solo uso (no commiteado)
que escribe el PNG con `node:zlib`, y se sustituye cuando haya material
gráfico de marca.

**Pruebas**: `app/page.test.tsx` cubre los cinco redirects, la landing
(`h1`, las cuatro tarjetas, «Entrar» → `/login`, `mailto:` con el correo
por defecto, tiendas ocultas sin variables), la pantalla de cuenta de app y
`generateMetadata`, más `axe` en los dos estados de render — la raíz entra
así en la lista de páginas con test de accesibilidad.
`middleware.test.ts` fija la raíz pública (sin cookie y con el refresh
rechazado pasa; con refresh válido sigue reenviando el access).
`lib/config/site.test.ts`, `app/robots.test.ts` y `app/sitemap.test.ts`
cubren los tres módulos que sí cuentan para el umbral de cobertura.
`e2e/landing.spec.ts` (dos logins de UI, ninguno de API): la landing sin
sesión, `panel-demo-asociacion-bidasoa-p01@test.com` (sin rol de panel) en
«Tu cuenta es de la app», y el titular de Bidasoa que visita `/` con sesión
y aterriza en su entidad.

**Fuera de alcance** (fases siguientes ya acordadas, spec §9): páginas por
público (`/asociaciones`, …); formulario de contacto guardado en plataforma
(«Solicitudes»); alta de entidades desde la web; versión web de la app para
usuarios finales; material gráfico de marca. Sin cambios en el backend ni en
el móvil.
```

- [ ] **Step 4: Actualizar el bullet de cobertura de `CLAUDE.md`**

Medir la cobertura real:

Run: `npx vitest run --coverage`
Expected: la suite entera en verde y el umbral de 99,7 de líneas superado.

Anota del resumen de v8 dos datos de la fila **All files**: el porcentaje
de líneas (`% Lines`) y, del bloque final de Vitest, el número de tests y
de ficheros de test. Luego, en el primer bullet de la sección
`## Cobertura`, **al final del texto existente** (después de la frase que
acaba «…así que el ratchet no sube.»), añadir una frase con esos valores
exactos, con este molde:

```
  Tras la landing pública y el login único (2026-09-20, Tareas 1-6):
  **<% de líneas con coma decimal> %** (<líneas cubiertas>/<líneas totales>
  líneas, <nº de tests> tests, <nº de ficheros> ficheros — tres ficheros
  nuevos que sí cuentan para la medición, `lib/config/site.ts`,
  `app/robots.ts` y `app/sitemap.ts`, los tres con test propio; los
  componentes de `components/landing/` son `.tsx` y, como el resto del
  panel, se prueban por comportamiento). El umbral sigue en 99,7.
```

Si el porcentaje real **superara** 100 − 0,3 del umbral vigente (es decir,
si `real − 0,3 > 99,7`), sube `vitest.config.ts::coverage.thresholds.lines`
a `real − 0,3` en el mismo commit: el ratchet solo sube, nunca baja.

- [ ] **Step 5: Copiar los dos cambios a `AGENTS.md`**

`AGENTS.md` es copia de `CLAUDE.md` salvo su línea de cabecera. Aplica ahí
la misma sección nueva (misma posición, justo antes de `## Comandos`) y la
misma frase de cobertura, y comprueba que no queda ninguna otra diferencia:

```bash
diff <(tail -n +3 CLAUDE.md) <(tail -n +3 AGENTS.md)
```
Expected: sin diferencias (si las hubiera, son previas a esta tarea: no las
arregles aquí, anótalas).

- [ ] **Step 6: Verificación completa**

Run: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
Expected: todo en verde, con la cobertura de líneas por encima de 99,7.

- [ ] **Step 7: Commit**

```bash
git add e2e/landing.spec.ts CLAUDE.md AGENTS.md vitest.config.ts
git commit -m "$(cat <<'EOF'
test(e2e): flujos de la landing y documentación de la rama

e2e/landing.spec.ts cubre los tres flujos de la spec (landing sin sesión,
cuenta sin rol de panel y titular que visita la raíz con sesión), con dos
logins de UI. CLAUDE.md y AGENTS.md ganan la sección «Landing pública y
login único (2026-09-20)» y la cifra real de cobertura.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

## Decisiones tomadas donde la spec dejaba margen

1. **`redirectToLogin` pierde la excepción de la raíz** (spec §3.2 lo dejaba «a decisión del implementador con test»): con `/` desviada a `passThroughWithoutAccess` antes de llegar a esa función, la rama `pathname !== "/"` quedaba muerta — y una rama muerta en `middleware.ts`, que sí cuenta para la cobertura, bajaría el porcentaje sin aportar nada.
2. **`title.absolute` en `generateMetadata`** (spec §6 solo dice «`title`»): el layout raíz aplica la plantilla `"%s · Popyplan"` a todo título de página y el de la landing ya lleva la marca; sin `absolute` saldría duplicada.
3. **`public/og.png` sin texto**: la spec la describe con la marca y la frase de portada, pero ninguna dependencia instalada rasteriza texto y añadir una queda fuera del alcance; se entrega el liso del color de marca que la propia spec admite como provisional («se sustituye cuando haya material de marca»).
4. **Los componentes de la landing traducen con `useTranslations`, no con `getTranslations`**: la spec dice «todo texto vía `getTranslations("landing")`», pero eso obliga a componentes `async`, que Testing Library no puede renderizar dentro del árbol de `app/page.tsx`. Solo la página y su `generateMetadata` son `async` y usan `getTranslations`; los bloques son síncronos y usan el equivalente de cliente, que next-intl también sirve en RSC.
5. **La tarjeta «Personas» no tiene `mailto:`**: la spec pide «su llamada» en las cuatro tarjetas, pero el público de personas no escribe a nadie — su llamada son los botones de tienda (`StoreLinks` con etiqueta), que desaparecen enteros si todavía no hay ficha publicada.
