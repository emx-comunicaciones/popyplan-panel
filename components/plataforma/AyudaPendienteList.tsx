"use client";

/**
 * «Ayuda» de plataforma: avisos de «hoy lo llevo mal» pendientes de
 * todas las entidades a la vez (`usePlatformPendingHelpRequests`, ruta
 * agregada del backend desde la tarea P7, `docs/PANEL.md` §10.1).
 */
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAcknowledgeHelpRequestGlobal } from "@/hooks/useAcknowledgeHelpRequestGlobal";
import { usePlatformPendingHelpRequests } from "@/hooks/usePlatformPendingHelpRequests";
import type { HelpRequestRow } from "@/lib/api/types";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

function HelpRequestCard({ request }: { request: HelpRequestRow }) {
  const acknowledge = useAcknowledgeHelpRequestGlobal();

  return (
    <li>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-text-base">{request.user_display.public_name}</p>
            <p className="text-sm text-text-secondary">
              {request.organization_display ? request.organization_display.name : "Sin entidad"}
              {request.community_display ? ` · ${request.community_display.name}` : ""}
            </p>
            <p className="text-xs text-text-secondary">{formatDateTime(request.created_at)}</p>
          </div>
          {request.acknowledged_at ? (
            <Badge tone="success">Atendido</Badge>
          ) : (
            <Button
              type="button"
              disabled={acknowledge.isPending}
              onClick={() => acknowledge.mutate(request.id)}
            >
              He contactado
            </Button>
          )}
        </div>
        {acknowledge.isError ? (
          <p role="alert" className="mt-2 text-sm text-error">
            {acknowledge.error.message}
          </p>
        ) : null}
      </Card>
    </li>
  );
}

export function AyudaPendienteList() {
  const requests = usePlatformPendingHelpRequests();

  if (requests.isError) {
    return <ErrorState title="No se pudieron cargar los avisos de ayuda" description={requests.error.message} />;
  }
  if (!requests.data) {
    return <p className="text-sm text-text-secondary">Cargando avisos…</p>;
  }
  if (requests.data.length === 0) {
    return (
      <EmptyState
        title="Sin avisos pendientes"
        description="Ninguna entidad tiene avisos de ayuda sin atender."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {requests.data.map((request) => (
        <HelpRequestCard key={request.id} request={request} />
      ))}
    </ul>
  );
}
