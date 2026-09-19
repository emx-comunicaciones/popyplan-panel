"use client";

/**
 * Listado de programas de la entidad (`docs/PANEL.md` §12): visible para
 * cualquier rol con `ver_panel` (titular, moderador, dinamizador,
 * analista, referente — `lib/auth/entidadMenu.ts`); solo `canManage`
 * (titular/moderador) ve «Nuevo programa».
 */
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { usePrograms } from "@/hooks/usePrograms";
import type { ProgramStatus } from "@/lib/api/types";
import { localeFor, activeLanguage } from "@/lib/i18n/locale";
import { formatEuros } from "@/lib/programs/money";

import { ProgramaForm } from "./ProgramaForm";

export interface ProgramasPanelProps {
  orgId: number | string;
  slug: string;
  canManage: boolean;
}

export const PROGRAM_STATUS_KEYS: Record<ProgramStatus, string> = {
  draft: "programs.status.draft",
  active: "programs.status.active",
  closed: "programs.status.closed",
};

const STATUS_TONES: Record<ProgramStatus, BadgeTone> = {
  draft: "neutral",
  active: "success",
  closed: "info",
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(localeFor(activeLanguage()));
}

export function ProgramasPanel({ orgId, slug, canManage }: ProgramasPanelProps) {
  const t = useTranslations();
  const programs = usePrograms(orgId);
  const [creating, setCreating] = useState(false);
  const [createPending, setCreatePending] = useState(false);

  if (programs.isError) {
    return (
      <ErrorState
        title={t("entidad.programas.loadError")}
        description={t("entidad.programas.loadErrorDescription")}
      />
    );
  }
  if (!programs.data) {
    return <p className="text-sm text-text-secondary">{t("entidad.programas.loading")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <div>
          <Button type="button" onClick={() => setCreating(true)}>
            {t("entidad.programas.newProgram")}
          </Button>
        </div>
      ) : null}

      {programs.data.length === 0 ? (
        <EmptyState title={t("entidad.programas.empty")} />
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
                    <Badge tone={STATUS_TONES[program.status]}>{t(PROGRAM_STATUS_KEYS[program.status])}</Badge>
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
        title={t("entidad.programas.newProgram")}
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
