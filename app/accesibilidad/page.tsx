import type { Metadata } from "next";

import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = { title: "Declaración de accesibilidad" };

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_A11Y_CONTACT || "accesibilidad@popyplan.com";

/**
 * Declaración de accesibilidad (tarea W1, Fase 6), conforme al RD
 * 1112/2018. Página pública, sin sesión: no depende de
 * `getServerSession` ni redirige nunca. Enlazada desde el pie de los
 * tres layouts de área y del login (`components/layout/Footer.tsx`).
 *
 * «Situación de cumplimiento» se mantiene en «parcialmente conforme»
 * hasta el cierre de la tarea W5 de esta fase (e2e de teclado +
 * cobertura completa de axe); pasar a «plenamente conforme» es una
 * frase de esta página, no un cambio de código.
 */
export default function AccesibilidadPage() {
  return (
    <>
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-6 text-2xl font-semibold text-text-base">
          Declaración de accesibilidad de Popyplan
        </h1>

        <section aria-labelledby="alcance" className="mb-6">
          <h2 id="alcance" className="mb-2 text-lg font-semibold text-text-base">
            Alcance
          </h2>
          <p className="text-sm text-text-secondary">
            Esta declaración cubre el panel web <strong>popyplan-panel</strong> (este sitio,
            servido bajo este mismo dominio) y la aplicación móvil <strong>Popyplan</strong>{" "}
            (iOS y Android). No cubre contenido de terceros incrustado (por ejemplo, imágenes o
            documentos subidos por una entidad) ni sitios enlazados fuera de estos dos productos.
          </p>
        </section>

        <section aria-labelledby="situacion" className="mb-6">
          <h2 id="situacion" className="mb-2 text-lg font-semibold text-text-base">
            Situación de cumplimiento
          </h2>
          <p className="text-sm text-text-secondary">
            Este sitio es <strong>parcialmente conforme</strong> con el nivel AA de la Norma
            UNE-EN 301549:2022 (WCAG 2.1), por las excepciones descritas en «Contenido no
            accesible». Pasará a «plenamente conforme» cuando la auditoría automática (axe) y las
            pruebas manuales de teclado cubran todas las páginas sin excepciones documentadas
            (Fase 6, tarea W5 de este panel).
          </p>
        </section>

        <section aria-labelledby="no-accesible" className="mb-6">
          <h2 id="no-accesible" className="mb-2 text-lg font-semibold text-text-base">
            Contenido no accesible
          </h2>
          <p className="mb-2 text-sm text-text-secondary">
            A fecha de esta declaración, las siguientes páginas del panel todavía no tienen un
            test automático de accesibilidad (axe) dedicado — la cobertura elegida hasta ahora es
            representativa de las tres áreas y de los patrones compartidos (tablas, diálogos con
            foco atrapado, gráficos, formularios), pero no exhaustiva:
          </p>
          <p className="text-sm text-text-secondary">
            Comunidades, Actividades, Reportes, Guardia, Configuración, Comunicaciones, Encuestas
            y Recursos del panel de entidad; Informes del panel de paraguas; y Auditoría, Ayuda,
            Verificaciones, Roles, Reportes, Métricas y ficha de entidad del panel de plataforma.
            Ampliar esta cobertura es trabajo mecánico, documentado en <code>CLAUDE.md</code>{" "}
            («Accesibilidad»).
          </p>
        </section>

        <section aria-labelledby="preparacion" className="mb-6">
          <h2 id="preparacion" className="mb-2 text-lg font-semibold text-text-base">
            Preparación de la declaración
          </h2>
          <p className="text-sm text-text-secondary">
            Esta declaración se preparó el 5 de septiembre de 2026. Se revisó mediante evaluación
            automática (<code>axe-core</code> sobre las páginas con test dedicado, ver «Contenido
            no accesible») y revisión manual de teclado y lector de pantalla sobre los flujos
            principales de las tres áreas del panel.
          </p>
        </section>

        <section aria-labelledby="contacto" className="mb-6">
          <h2 id="contacto" className="mb-2 text-lg font-semibold text-text-base">
            Observaciones y datos de contacto
          </h2>
          <p className="text-sm text-text-secondary">
            Puedes comunicar cualquier problema de accesibilidad, o pedir información en un
            formato accesible, escribiendo a{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary-700 underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section aria-labelledby="procedimiento">
          <h2 id="procedimiento" className="mb-2 text-lg font-semibold text-text-base">
            Procedimiento de aplicación
          </h2>
          <p className="text-sm text-text-secondary">
            Si tras dirigirte al correo de contacto no obtienes respuesta o no estás conforme con
            ella, puedes presentar una queja o una reclamación por disconformidad conforme al
            artículo 13 del{" "}
            <a
              href="https://www.boe.es/eli/es/rd/2018/09/07/1112"
              className="font-medium text-primary-700 underline"
            >
              Real Decreto 1112/2018
            </a>
            .
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
