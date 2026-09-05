"use client";

/**
 * Inicio de plataforma (tarea W5): tarjetas de `GET
 * /api/admin/dashboard-stats/` (usuarios activos, actividades
 * programadas — solo si el rol tiene `is_staff`, ver
 * `hooks/useDashboardStats.ts`), reportes pendientes (cola global,
 * oculta para `verifier`, que no tiene acceso), solicitudes de ayuda
 * pendientes (agregado por entidad, ver el hueco de contrato en
 * `hooks/usePlatformPendingHelpRequests.ts`) y entidades verificadas/
 * pendientes (`GET /api/organizations/`, abierto a cualquier
 * autenticado). Qué tarjetas se muestran sigue la misma matriz que el
 * menú (`lib/auth/plataformaMenu.ts::plataformaMenuFor`), para no
 * enlazar a una sección que ese rol no puede abrir.
 */
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useOrganizations } from "@/hooks/useOrganizations";
import { usePlatformPendingHelpRequests } from "@/hooks/usePlatformPendingHelpRequests";
import { useReportsQueue } from "@/hooks/useReportsQueue";
import { plataformaMenuFor } from "@/lib/auth/plataformaMenu";

export interface PlataformaHomeDashboardProps {
  role: string | null;
}

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

export function PlataformaHomeDashboard({ role }: PlataformaHomeDashboardProps) {
  const menu = plataformaMenuFor(role);
  const stats = useDashboardStats();
  const reports = useReportsQueue(undefined, { status: "pending" });
  const helpRequests = usePlatformPendingHelpRequests();
  const verified = useOrganizations({ verified: true });
  const pending = useOrganizations({ verified: false });

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {stats.data ? (
        <>
          <KpiCard label="Usuarios activos" value={String(stats.data.users.active)} />
          <KpiCard label="Actividades programadas" value={String(stats.data.events.scheduled)} />
        </>
      ) : null}

      {menu.includes("reportes") && reports.data ? (
        <KpiCard label="Reportes pendientes" value={String(reports.data.length)} href="/plataforma/reportes" />
      ) : null}

      {menu.includes("ayuda") && helpRequests.data ? (
        <KpiCard
          label="Solicitudes de ayuda pendientes"
          value={String(helpRequests.data.length)}
          href="/plataforma/ayuda"
        />
      ) : null}

      {menu.includes("entidades") && verified.data ? (
        <KpiCard label="Entidades verificadas" value={String(verified.data.count)} href="/plataforma/entidades" />
      ) : null}
      {menu.includes("entidades") && pending.data ? (
        <KpiCard
          label="Entidades pendientes de verificar"
          value={String(pending.data.count)}
          href="/plataforma/entidades"
        />
      ) : null}
    </div>
  );
}
