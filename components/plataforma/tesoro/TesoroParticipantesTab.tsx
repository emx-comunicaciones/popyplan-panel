"use client";

/**
 * Pestaña «Participantes» de la ficha de un juego:
 * `GET .../participants/?status=` con filtro por estado, y aprobar o
 * rechazar las solicitudes `pending` (el backend solo lo admite con el
 * juego en `draft`/`open`, así que fuera de esos estados no se ofrece).
 * Rechazar pide confirmación: quien fue rechazada no puede volver a
 * unirse a ese juego (`join` → 403). Aprobar no, porque es lo que la
 * persona pidió. En esta versión unirse desde la app entra ya aceptada,
 * así que las solicitudes pendientes son raras; la pestaña lo dice.
 *
 * El admin de plataforma ve nombre y usuario de quien juega (es gestión de
 * cuentas, como Usuarios), nunca contacto.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useTreasureParticipants } from "@/hooks/useTreasureHunt";
import { useDecideTreasureParticipant } from "@/hooks/useTreasureHuntMutations";
import type { TreasureParticipant, TreasureParticipantStatus } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

import {
  FIELD_CLASS,
  LABEL_CLASS,
  PARTICIPANT_STATUS_KEYS,
  TREASURE_ERROR_FALLBACK,
  TREASURE_ERROR_KEYS,
  formatDateTime,
} from "./shared";

const STATUS_TONES: Record<TreasureParticipantStatus, BadgeTone> = {
  pending: "info",
  accepted: "success",
  rejected: "error",
};

const FILTERS: readonly (TreasureParticipantStatus | "")[] = ["", "pending", "accepted", "rejected"];

export function participantName(participant: Pick<TreasureParticipant, "full_name" | "username">): string {
  return participant.full_name?.trim() || participant.username;
}

export function TesoroParticipantesTab({ gameId, gameStatus }: { gameId: string; gameStatus: string | undefined }) {
  const t = useTranslations();
  const [status, setStatus] = useState<TreasureParticipantStatus | "">("");
  const participants = useTreasureParticipants(gameId, status);
  const decide = useDecideTreasureParticipant(gameId);
  const [rejecting, setRejecting] = useState<TreasureParticipant | null>(null);

  const canDecide = gameStatus === "draft" || gameStatus === "open";

  function closeReject() {
    decide.reset();
    setRejecting(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="w-56">
        <label htmlFor="tesoro-participantes-status" className={LABEL_CLASS}>
          {t("plataforma.tesoroFicha.participantes.filterLabel")}
        </label>
        <select
          id="tesoro-participantes-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as TreasureParticipantStatus | "")}
          className={FIELD_CLASS}
        >
          {FILTERS.map((value) => (
            <option key={value || "all"} value={value}>
              {value ? t(PARTICIPANT_STATUS_KEYS[value]) : t("plataforma.tesoroFicha.participantes.filterAll")}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-text-secondary">{t("plataforma.tesoroFicha.participantes.hint")}</p>

      {decide.isError && !rejecting ? (
        <p role="alert" className="text-sm text-error">
          {errorKindText(decide.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK)}
        </p>
      ) : null}

      {participants.isError ? (
        <ErrorState
          title={t("plataforma.tesoroFicha.participantes.loadError")}
          description={errorKindText(participants.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK)}
        />
      ) : !participants.data ? (
        <p className="text-sm text-text-secondary">{t("common.loading")}</p>
      ) : participants.data.length === 0 ? (
        <EmptyState title={t("plataforma.tesoroFicha.participantes.empty")} />
      ) : (
        <Table
          caption={t("plataforma.tesoroFicha.participantes.tableCaption")}
          rows={participants.data}
          getRowKey={(participant) => String(participant.id)}
          columns={[
            { key: "name", header: t("plataforma.tesoroFicha.participantes.nameHeader"), render: participantName },
            { key: "username", header: t("plataforma.tesoroFicha.participantes.usernameHeader"), render: (p) => p.username },
            {
              key: "status",
              header: t("plataforma.tesoroFicha.participantes.statusHeader"),
              render: (p) =>
                p.status ? (
                  <Badge tone={STATUS_TONES[p.status]}>{t(PARTICIPANT_STATUS_KEYS[p.status])}</Badge>
                ) : (
                  "—"
                ),
            },
            { key: "team", header: t("plataforma.tesoroFicha.participantes.teamHeader"), render: (p) => p.team_name || "—" },
            { key: "joined", header: t("plataforma.tesoroFicha.participantes.joinedHeader"), render: (p) => formatDateTime(p.joined_at) },
            {
              key: "actions",
              header: <span className="sr-only">{t("common.actions")}</span>,
              render: (p) =>
                p.status === "pending" && canDecide ? (
                  <span className="flex gap-2">
                    <Button
                      type="button"
                      disabled={decide.isPending}
                      onClick={() => {
                        decide.reset();
                        decide.mutate({ participantId: p.id, approve: true });
                      }}
                    >
                      {t("plataforma.tesoroFicha.participantes.approve")}
                    </Button>
                    <Button type="button" variant="danger" disabled={decide.isPending} onClick={() => {
                      decide.reset();
                      setRejecting(p);
                    }}>
                      {t("plataforma.tesoroFicha.participantes.reject")}
                    </Button>
                  </span>
                ) : null,
            },
          ]}
        />
      )}

      <ConfirmDialog
        open={rejecting !== null}
        title={t("plataforma.tesoroFicha.participantes.rejectTitle")}
        description={
          <>
            <span>
              {t("plataforma.tesoroFicha.participantes.rejectDescription", {
                name: rejecting ? participantName(rejecting) : "",
              })}
            </span>
            {decide.isError ? (
              <span role="alert" className="mt-2 block text-error">
                {errorKindText(decide.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK)}
              </span>
            ) : null}
          </>
        }
        confirmLabel={t("plataforma.tesoroFicha.participantes.reject")}
        pending={decide.isPending}
        onCancel={closeReject}
        onConfirm={() => {
          if (rejecting) {
            decide.mutate({ participantId: rejecting.id, approve: false }, { onSuccess: () => setRejecting(null) });
          }
        }}
      />
    </div>
  );
}
