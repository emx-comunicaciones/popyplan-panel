import { request, type APIRequestContext } from "@playwright/test";

import { mundo, persona } from "./personas";

/**
 * Llamadas directas al backend de pruebas para preparar lo que la pantalla
 * no deja provocar (un reporte recién hecho por otra persona) o para leer
 * datos sin depender de la UI. Login por `POST /api/auth/login/`, como la
 * app; el entorno de pruebas no tiene tope de login.
 */
export async function apiComo(clave: string): Promise<APIRequestContext> {
  // `vecina_01`… no son personajes con ficha propia en personas.json, pero
  // sí cuentas: vienen en `vecinas`, con la misma contraseña.
  const indice = /^vecina_(\d+)$/.exec(clave);
  const p = indice
    ? { email: mundo().vecinas[Number(indice[1]) - 1].email, password: mundo().password }
    : persona(clave);
  const anonimo = await request.newContext({ baseURL: mundo().api_url });
  const login = await anonimo.post("/api/auth/login/", {
    data: { username_or_email: p.email, password: p.password },
  });
  if (!login.ok()) throw new Error(`login de ${clave}: ${login.status()}`);
  const { key } = await login.json();
  await anonimo.dispose();
  return request.newContext({
    baseURL: mundo().api_url,
    extraHTTPHeaders: { Authorization: `Bearer ${key}`, "Accept-Language": "es" },
  });
}

/** Iker publica en su comunidad de apoyo y una vecina del grupo le
 *  reporta: reporte nuevo en la cola de la asociación (no contra quien la
 *  modera, que iría a la de plataforma). Devuelve el id del reporte. */
export async function reporteNuevoEnLaAsociacion(texto: string): Promise<string> {
  const apoyo = mundo().comunidades.apoyo.id;
  const iker = await apiComo("busca_apoyo");
  const post = await iker.post(`/api/communities/${apoyo}/posts/create/`, {
    data: { content: texto },
  });
  if (!post.ok()) throw new Error(`post: ${post.status()} ${await post.text()}`);
  const postId = (await post.json()).id;
  await iker.dispose();

  const vecina = await apiComo("vecina_01");
  const reporte = await vecina.post("/api/safety/reports/", {
    data: { target_type: "post", target_id: postId, reason: "spam", description: texto },
  });
  if (!reporte.ok()) throw new Error(`reporte: ${reporte.status()} ${await reporte.text()}`);
  const id = (await reporte.json()).id as string;
  await vecina.dispose();
  return id;
}
