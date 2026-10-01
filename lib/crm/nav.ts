/**
 * Menú interno de la pestaña «Comercial» (CRM, `docs/CRM.md` del backend):
 * las secciones del punto 1 de la spec, como barra dentro de la pestaña
 * —no en el menú lateral de plataforma, que solo gana «Comercial»—.
 * «Configuración» solo para dirección comercial y administración (el
 * backend solo les deja escribir ahí); el resto lo ve todo el equipo, cada
 * cual con sus cuentas.
 */
import { isCrmManager } from "@/lib/auth/plataformaMenu";

export const CRM_BASE = "/plataforma/comercial";

export const CRM_SECTIONS = [
  "dashboard",
  "entidades",
  "contactos",
  "pipeline",
  "actividades",
  "tareas",
  "calendario",
  "mapa",
  "oportunidades",
  "documentos",
  "informes",
  "configuracion",
] as const;

export type CrmSection = (typeof CRM_SECTIONS)[number];

export const CRM_SECTION_LABELS: Record<CrmSection, string> = {
  dashboard: "crm.nav.dashboard",
  entidades: "crm.nav.entidades",
  contactos: "crm.nav.contactos",
  pipeline: "crm.nav.pipeline",
  actividades: "crm.nav.actividades",
  tareas: "crm.nav.tareas",
  calendario: "crm.nav.calendario",
  mapa: "crm.nav.mapa",
  oportunidades: "crm.nav.oportunidades",
  documentos: "crm.nav.documentos",
  informes: "crm.nav.informes",
  configuracion: "crm.nav.configuracion",
};

export function crmSectionHref(section: CrmSection): string {
  return section === "dashboard" ? CRM_BASE : `${CRM_BASE}/${section}`;
}

export function crmSectionsFor(role: string | null | undefined): CrmSection[] {
  return CRM_SECTIONS.filter((s) => s !== "configuracion" || isCrmManager(role));
}

export const crmAccountHref = (id: number | string) => `${CRM_BASE}/entidades/${id}`;
export const crmOpportunityHref = (id: number | string) => `${CRM_BASE}/oportunidades/${id}`;
