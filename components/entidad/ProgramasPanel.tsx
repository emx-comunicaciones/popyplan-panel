"use client";

/**
 * Listado de programas de la entidad (`docs/PANEL.md` §12): visible para
 * cualquier rol con `ver_panel` (titular, moderador, dinamizador,
 * analista, referente — `lib/auth/entidadMenu.ts`); solo `canManage`
 * (titular/moderador) ve «Nuevo programa».
 */
import Link from "next/link";
import { useState } from "react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { usePrograms } from "@/hooks/usePrograms";
import type { ProgramStatus } from "@/lib/api/types";
import { formatEuros } from "@/lib/programs/money";

import { ProgramaForm } from "./ProgramaForm";

export interface ProgramasPanelProps {
  orgId: number | string;
  slug: string;
  canManage: boolean;
}

const STATUS_LABELS: Record<ProgramStatus, string> = {
  draft: "Borrador",
  active: "En curso",
  closed: "Cerrado",
};

const STATUS_TONES: Record<ProgramStatus, BadgeTone> = {
  draft: "neutral",
  active: "success",
  closed: "info",
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES");
}

export function ProgramasPanel({ orgId, slug, canManage }: ProgramasPanelProps) {
  const programs = usePrograms(orgId);
  const [creating, setCreating] = useState(false);
  const [createPending, setCreatePending] = useState(false);

  if (programs.isError) {
    return (
      <ErrorState title="No se pudieron cargar los programas" description={programs.error.message} />
    );
  }
  if (!programs.data) {
    return <p className="text-sm text-text-secondary">Cargando programas…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <div>
          <Button type="button" onClick={() => setCreating(true)}>
            Nuevo programa
          </Button>
        </div>
      ) : null}

      {programs.data.length === 0 ? (
        <EmptyState title="Sin programas todavía" />
      ) : (
        <ul className="flex flex-col gap-3">
          {programs.data.map((program) => (
            <li key={program.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link
                      href={`/entidad/${slug}/programas/${program.id}`}
                      className="font-medium text-primary-700 underline-offset-2 hover:underline"
                    >
                      {program.name}
                    </Link>
                    <p className="text-sm text-text-secondary">
                      {formatDate(program.starts_on)} – {formatDate(program.ends_on)}
                      {program.funder ? ` · ${program.funder}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-base">{formatEuros(program.budget_cents)}</span>
                    <Badge tone={STATUS_TONES[program.status]}>{STATUS_LABELS[program.status]}</Badge>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={creating}
        titleId="nuevo-programa-title"
        title="Nuevo programa"
        pending={createPending}
        onClose={() => setCreating(false)}
      >
        <ProgramaForm
          orgId={orgId}
          editing="new"
          onDone={() => setCreating(false)}
          onPendingChange={setCreatePending}
        />
      </Dialog>
    </div>
  );
}
