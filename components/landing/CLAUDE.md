# components/landing/ — web pública

Detalle e historia: `docs/historial/landing.md`.

- **Discurso**: deporte, naturaleza y bienestar para gente sana; planes y
  comunidades sin alcohol ni drogas. **Nunca** mencionar asociaciones,
  ONG, administraciones, profesionales, panel institucional, adicciones,
  intervención, guardia, red de apoyo ni emparejamiento («match»: no
  existe en esta versión). El panel solo aparece como «Entrar» y «Acceso
  al panel».
- Ninguna promesa que el producto no cumpla ya.
- Tipografías Plus Jakarta Sans + DM Sans (`fonts.ts`) **solo** en la
  landing y `AppAccountScreen` (vía `LANDING_FONT_CLASS`); el resto del
  panel sigue con Geist.
- Tamaños en píxeles explícitos (`text-[56px]`…), no la escala `text-*`
  remapeada del panel.
- **Contraste**: el pie va en `--color-primary-700` sin blancos
  translúcidos (ni texto ni fondo); la tarjeta del QR es blanca entera con
  texto oscuro. Sobre fondo de marca el anillo de foco se fuerza blanco
  (`focus-visible:outline-text-inverse`); el global `primary-700` daría
  1:1. Banner con degradado `primary-600 → primary-700`. Pares en
  `lib/a11y/tokens.test.ts`.
- `ModeToggle` es el único componente con estado (`aria-pressed`, región
  `aria-live` siempre montada); sin ARIA tabs ni menú hamburguesa.
- Insignias de tienda: `aria-label` = **exactamente** el texto visible
  concatenado (WCAG 2.5.3), `target="_blank"` + `rel="noopener noreferrer"`.
- Imágenes con `next/image` y medidas explícitas; SVG con `unoptimized`.
  Los mockups se sustituyen reemplazando el PNG de `public/landing/` con
  el mismo nombre.
- Textos en `landing.*` de los cuatro catálogos; el año del copyright va
  como cadena. Enlaces de tienda y legales en `lib/config/site.ts`.
- El pie no usa `components/layout/Footer.tsx`: un cambio en el pie del
  panel hay que replicarlo a mano aquí.
