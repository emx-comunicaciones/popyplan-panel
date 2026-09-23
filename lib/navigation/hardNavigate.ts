/**
 * Navegación de documento completa (no del router de Next).
 *
 * Se usa justo después de entrar (`app/(auth)/login/LoginForm.tsx`): el
 * idioma de la sesión se decide en ese momento (la cookie `pp_lang` que
 * fija `POST /api/session` con `preferred_language` de la cuenta), y una
 * navegación del router puede reutilizar árbol ya renderizado con el
 * idioma anterior — incluida la raíz, que es quien pone `<html lang>` y
 * quien entrega el catálogo a los componentes de cliente. Ese desajuste
 * se veía como una pantalla a medias: menú y títulos en un idioma y el
 * contenido en otro (informe del propietario, 2026-09-23).
 *
 * Una carga completa al entrar no cuesta nada perceptible —la sesión
 * acaba de empezar, no hay estado de cliente que conservar— y quita de en
 * medio toda la coreografía de refrescos y su carrera.
 */
export function hardNavigate(url: string): void {
  window.location.assign(url);
}
