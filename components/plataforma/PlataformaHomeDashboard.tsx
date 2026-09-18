"use client";

/**
 * Inicio de plataforma (tarea W5): tarjetas de `GET
 * /api/admin/dashboard-stats/` (usuarios activos, actividades
 * programadas — solo si el rol tiene `is_staff`, ver
 * `hooks/useDashboardStats.ts`), reportes pendientes (cola global),
 * solicitudes de ayuda pendientes, entidades verificadas/pendientes
 * (`GET /api/organizations/`, abierto a cualquier autenticado) y, desde
 * la tarea W4 (`docs/PANEL.md` §13), el resumen de contratación
 * (`useBillingSummary`): contratos vigentes, valor anual y facturas
 * vencidas.
 *
 * **Cada tarjeta es su propio componente** y solo se monta si su sección
 * está en el menú del rol (`lib/auth/plataformaMenu.ts
 * ::plataformaMenuFor`). Eso no es solo cosmética: un hook de React no
 * puede llamarse condicionalmente, así que mientras las consultas vivían
 * en este componente se lanzaban igual para todos los roles y un
 * `verifier` pedía la cola de reportes, la ayuda y la facturación para
 * recibir tres 403 y no pintar nada.
 *
 * **Un fallo que no es de permisos no esconde la tarjeta**: se pinta con
 * «No disponible». Esconderla sugería un cero (ningún reporte pendiente)
 * donde en realidad no se pudo preguntar.
 */
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { useBillingSummary } from "@/hooks/useBilling";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useOrganizations } from "@/hooks/useOrganizations";
import { usePlatformPendingHelpRequests } from "@/hooks/usePlatformPendingHelpRequests";
import { useReportsQueue } from "@/hooks/useReportsQueue";
import { plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { formatEuros } from "@/lib/programs/money";

export interface PlataformaHomeDashboardProps {
  role: string | null;
}

const UNAVAILABLE = "No disponible";

function KpiCard({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = (
    <Card>
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="text-2xl font-semibold text-text-base">{value}</p>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

/**
 * `GET /api/admin/dashboard-stats/` pide `is_staff`, que hoy solo tiene
 * `superadmin`: el hook traduce ese 403 a `null` y las dos tarjetas
 * desaparecen (no es un error, ese rol simplemente no las tiene).
 */
function EstadisticasCards() {
  const stats = useDashboardStats();

  if (stats.isError) {
    return (
      <>
        <KpiCard label="Usuarios activos" value={UNAVAILABLE} />
        <KpiCard label="Actividades programadas" value={UNAVAILABLE} />
      </>
    );
  }
  if (!stats.data) return null;

  return (
    <>
      <KpiCard label="Usuarios activos" value={String(stats.data.users.active)} />
      <KpiCard label="Actividades programadas" value={String(stats.data.events.scheduled)} />
    </>
  );
}

function ReportesPendientesCard() {
  const reports = useReportsQueue(undefined, { status: "pending" });

  if (reports.isError) {
    if (reports.error.kind === "sin_acceso") return null;
    return <KpiCard label="Reportes pendientes" value={UNAVAILABLE} href="/plataforma/reportes" />;
  }
  if (!reports.data) return null;

  return (
    <KpiCard label="Reportes pendientes" value={String(reports.data.length)} href="/plataforma/reportes" />
  );
}

/**
 * `usePlatformPendingHelpRequests` no distingue hoy el 403 del resto de
 * fallos (un solo tipo de error), así que cualquier fallo se pinta como
 * «No disponible» — el rol que llega aquí tiene «ayuda» en su menú y por
 * tanto acceso a la ruta.
 */
function AyudaPendienteCard() {
  const helpRequests = usePlatformPendingHelpRequests();

  if (helpRequests.isError) {
    return (
      <KpiCard label="Solicitudes de ayuda pendientes" value={UNAVAILABLE} href="/plataforma/ayuda" />
    );
  }
  if (!helpRequests.data) return null;

  return (
    <KpiCard
      label="Solicitudes de ayuda pendientes"
      value={String(helpRequests.data.length)}
      href="/plataforma/ayuda"
    />
  );
}

function EntidadesCards() {
  const verified = useOrganizations({ verified: true });
  const pending = useOrganizations({ verified: false });

  return (
    <>
      {verified.isError || verified.data ? (
        <KpiCard
          label="Entidades verificadas"
          value={verified.data ? String(verified.data.count) : UNAVAILABLE}
          href="/plataforma/entidades"
        />
      ) : null}
      {pending.isError || pending.data ? (
        <KpiCard
          label="Entidades pendientes de verificar"
          value={pending.data ? String(pending.data.count) : UNAVAILABLE}
          href="/plataforma/entidades"
        />
      ) : null}
    </>
  );
}

function ContratacionCards() {
  const billing = useBillingSummary();

  if (billing.isError) {
    if (billing.error.kind === "sin_acceso") return null;
    return (
      <>
        <KpiCard label="Contratos vigentes" value={UNAVAILABLE} href="/plataforma/contratos" />
        <KpiCard label="Valor anual contratado" value={UNAVAILABLE} href="/plataforma/contratos" />
        <KpiCard label="Facturas vencidas" value={UNAVAILABLE} href="/plataforma/contratos" />
      </>
    );
  }
  if (!billing.data) return null;

  return (
    <>
      <KpiCard
        label="Contratos vigentes"
        value={String(billing.data.active_contracts)}
        href="/plataforma/contratos"
      />
      <KpiCard
        label="Valor anual contratado"
        value={formatEuros(billing.data.annual_value_cents)}
        href="/plataforma/contratos"
      />
      <KpiCard
        label="Facturas vencidas"
        value={String(billing.data.overdue_invoices)}
        href="/plataforma/contratos"
      />
    </>
  );
}

export function PlataformaHomeDashboard({ role }: PlataformaHomeDashboardProps) {
  const menu = plataformaMenuFor(role);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <EstadisticasCards />
      {menu.includes("reportes") ? <ReportesPendientesCard /> : null}
      {menu.includes("ayuda") ? <AyudaPendienteCard /> : null}
      {menu.includes("entidades") ? <EntidadesCards /> : null}
      {menu.includes("contratos") ? <ContratacionCards /> : null}
    </div>
  );
}
