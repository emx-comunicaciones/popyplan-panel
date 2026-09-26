"use client";

/**
 * Listado de juegos de la búsqueda del tesoro (admin de plataforma,
 * bloque 2): `GET /api/treasure-hunt/` (array plano, borradores incluidos
 * para quien administra). «Nuevo juego» abre el formulario en un `Dialog`
 * y, al crearlo, lleva a su ficha; «Borrar» pide confirmación (borra
 * también la actividad publicada, si la hay) con el error dentro del
 * diálogo (patrón M6-M10 del panel).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useTreasureGames } from "@/hooks/useTreasureHunt";
import { useCreateTreasureGame, useDeleteTreasureGame } from "@/hooks/useTreasureHuntMutations";
import type { TreasureGame, TreasureGameStatus } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

import { TesoroJuegoForm } from "./TesoroJuegoForm";
import {
  GAME_STATUS_TONES,
  TREASURE_ERROR_FALLBACK,
  TREASURE_ERROR_KEYS,
  formatDateTime,
  gameStatusKey,
} from "./shared";

export function gameHref(id: string): string {
  return `/plataforma/busca-del-tesoro/${id}`;
}

export function GameStatusBadge({ status }: { status: string | undefined }) {
  const t = useTranslations();
  const key = gameStatusKey(status);
  return (
    <Badge tone={key ? GAME_STATUS_TONES[status as TreasureGameStatus] : "neutral"}>{key ? t(key) : status}</Badge>
  );
}

export function TesoroJuegosTable() {
  const t = useTranslations();
  const router = useRouter();
  const games = useTreasureGames();
  const create = useCreateTreasureGame();
  const remove = useDeleteTreasureGame();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TreasureGame | null>(null);

  function closeCreate() {
    create.reset();
    setCreating(false);
  }

  function closeDelete() {
    remove.reset();
    setDeleting(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button type="button" onClick={() => setCreating(true)}>
          {t("plataforma.tesoro.newGame")}
        </Button>
      </div>

      {games.isError ? (
        <ErrorState
          title={t("plataforma.tesoro.loadError")}
          description={errorKindText(games.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK)}
        />
      ) : !games.data ? (
        <p className="text-sm text-text-secondary">{t("common.loading")}</p>
      ) : games.data.length === 0 ? (
        <EmptyState title={t("plataforma.tesoro.empty")} description={t("plataforma.tesoro.emptyHint")} />
      ) : (
        <Table
          caption={t("plataforma.tesoro.tableCaption")}
          rows={games.data}
          getRowKey={(game) => game.id}
          columns={[
            {
              key: "name",
              header: t("plataforma.tesoro.nameHeader"),
              render: (game) => (
                <Link href={gameHref(game.id)} className="font-medium text-primary-700 underline">
                  {game.name}
                </Link>
              ),
            },
            { key: "status", header: t("plataforma.tesoro.statusHeader"), render: (game) => <GameStatusBadge status={game.status} /> },
            { key: "start", header: t("plataforma.tesoro.startHeader"), render: (game) => formatDateTime(game.start_time) },
            {
              key: "participants",
              header: t("plataforma.tesoro.participantsHeader"),
              render: (game) =>
                game.max_participants
                  ? t("plataforma.tesoro.participantsOf", { count: game.participants_count, max: game.max_participants })
                  : String(game.participants_count),
            },
            { key: "steps", header: t("plataforma.tesoro.stepsHeader"), render: (game) => String(game.steps_count) },
            {
              key: "featured",
              header: t("plataforma.tesoro.featuredHeader"),
              render: (game) => (game.is_featured ? <Badge tone="info">{t("plataforma.tesoro.featuredBadge")}</Badge> : "—"),
            },
            {
              key: "actions",
              header: <span className="sr-only">{t("common.actions")}</span>,
              render: (game) => (
                <Button type="button" variant="danger" onClick={() => setDeleting(game)}>
                  {t("plataforma.tesoro.delete")}
                </Button>
              ),
            },
          ]}
        />
      )}

      <Dialog
        open={creating}
        titleId="tesoro-nuevo-juego-title"
        title={t("plataforma.tesoro.newGame")}
        onClose={closeCreate}
        pending={create.isPending}
        widthClassName="max-w-2xl"
      >
        <TesoroJuegoForm
          pending={create.isPending}
          submitLabel={t("plataforma.tesoro.createAction")}
          onCancel={closeCreate}
          error={
            create.isError ? errorKindText(create.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK) : undefined
          }
          onSubmit={(input) =>
            create.mutate(input as Parameters<typeof create.mutate>[0], {
              onSuccess: (game) => router.push(gameHref(game.id)),
            })
          }
        />
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title={t("plataforma.tesoro.deleteTitle")}
        description={
          <>
            <span>{t("plataforma.tesoro.deleteDescription", { name: deleting?.name ?? "" })}</span>
            {remove.isError ? (
              <span role="alert" className="mt-2 block text-error">
                {errorKindText(remove.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK)}
              </span>
            ) : null}
          </>
        }
        confirmLabel={t("plataforma.tesoro.delete")}
        pending={remove.isPending}
        onCancel={closeDelete}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
