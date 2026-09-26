"use client";

/**
 * Pestaña «Premios» de la ficha de un juego: tramos por posición del
 * ranking (`GET .../prize-tiers/`, ordenados por `rank_from`), alta/edición
 * en un `Dialog` y borrado con `ConfirmDialog`. El backend rechaza dos
 * tramos que se solapan; el panel lo comprueba antes con la misma regla
 * (`lib/treasureHunt/validation.ts::validatePrizeTier`) y, si aun así
 * llega el 400, pinta su texto literal.
 */
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useTreasurePrizeTiers } from "@/hooks/useTreasureHunt";
import { useDeleteTreasurePrizeTier, useSaveTreasurePrizeTier } from "@/hooks/useTreasureHuntMutations";
import type { TreasurePrizeTier } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { validatePrizeTier, type PrizeTierErrorKind } from "@/lib/treasureHunt/validation";

import { FIELD_CLASS, LABEL_CLASS, TREASURE_ERROR_FALLBACK, TREASURE_ERROR_KEYS } from "./shared";

const TIER_ERROR_KEYS: Record<PrizeTierErrorKind, string> = {
  rango_invalido: "plataforma.tesoroFicha.premios.errors.badRange",
  desde_mayor: "plataforma.tesoroFicha.premios.errors.fromAfterTo",
  solapa: "plataforma.tesoroFicha.premios.errors.overlap",
};

interface TierFormProps {
  gameId: string;
  tiers: TreasurePrizeTier[];
  editing: TreasurePrizeTier | null;
  onDone: () => void;
}

function TierForm({ gameId, tiers, editing, onDone }: TierFormProps) {
  const t = useTranslations();
  const save = useSaveTreasurePrizeTier(gameId);
  const nextFrom = tiers.reduce((max, tier) => Math.max(max, tier.rank_to), 0) + 1;
  const [rankFrom, setRankFrom] = useState(String(editing?.rank_from ?? nextFrom));
  const [rankTo, setRankTo] = useState(String(editing?.rank_to ?? nextFrom));
  const [name, setName] = useState(editing?.tier_name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");

  const problem = validatePrizeTier(Number(rankFrom), Number(rankTo), tiers, editing?.id);
  const canSubmit = !problem && name.trim() !== "";

  function close() {
    save.reset();
    onDone();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || save.isPending) return;
    save.mutate(
      {
        tierId: editing?.id,
        input: {
          rank_from: Number(rankFrom),
          rank_to: Number(rankTo),
          tier_name: name.trim(),
          description: description.trim(),
        },
      },
      { onSuccess: onDone },
    );
  }

  return (
    <Dialog
      open
      titleId="tesoro-premio-title"
      title={editing ? t("plataforma.tesoroFicha.premios.editTitle") : t("plataforma.tesoroFicha.premios.newTitle")}
      onClose={close}
      pending={save.isPending}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <div className="min-w-28 flex-1">
            <label htmlFor="tesoro-premio-from" className={LABEL_CLASS}>
              {t("plataforma.tesoroFicha.premios.rankFrom")}
            </label>
            <input id="tesoro-premio-from" type="number" min={1} value={rankFrom} onChange={(e) => setRankFrom(e.target.value)} className={FIELD_CLASS} />
          </div>
          <div className="min-w-28 flex-1">
            <label htmlFor="tesoro-premio-to" className={LABEL_CLASS}>
              {t("plataforma.tesoroFicha.premios.rankTo")}
            </label>
            <input id="tesoro-premio-to" type="number" min={1} value={rankTo} onChange={(e) => setRankTo(e.target.value)} className={FIELD_CLASS} />
          </div>
        </div>
        {problem ? (
          <p role="alert" className="text-sm text-error">
            {t(TIER_ERROR_KEYS[problem])}
          </p>
        ) : null}
        <div>
          <label htmlFor="tesoro-premio-name" className={LABEL_CLASS}>
            {t("plataforma.tesoroFicha.premios.name")}
          </label>
          <input id="tesoro-premio-name" type="text" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={FIELD_CLASS} />
        </div>
        <div>
          <label htmlFor="tesoro-premio-description" className={LABEL_CLASS}>
            {t("plataforma.tesoroFicha.premios.description")}
          </label>
          <textarea
            id="tesoro-premio-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={FIELD_CLASS}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={!canSubmit || save.isPending}>
            {editing ? t("common.save") : t("plataforma.tesoroFicha.premios.createAction")}
          </Button>
          <Button type="button" variant="secondary" onClick={close} disabled={save.isPending}>
            {t("common.cancel")}
          </Button>
        </div>
        {save.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(save.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK)}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

export function TesoroPremiosTab({ gameId }: { gameId: string }) {
  const t = useTranslations();
  const tiers = useTreasurePrizeTiers(gameId);
  const remove = useDeleteTreasurePrizeTier(gameId);
  const [editing, setEditing] = useState<TreasurePrizeTier | "new" | null>(null);
  const [deleting, setDeleting] = useState<TreasurePrizeTier | null>(null);

  function closeDelete() {
    remove.reset();
    setDeleting(null);
  }

  if (tiers.isError) {
    return (
      <ErrorState
        title={t("plataforma.tesoroFicha.premios.loadError")}
        description={errorKindText(tiers.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK)}
      />
    );
  }
  if (!tiers.data) {
    return <p className="text-sm text-text-secondary">{t("common.loading")}</p>;
  }

  const rows = [...tiers.data].sort((a, b) => a.rank_from - b.rank_from);

  function rankText(tier: TreasurePrizeTier): string {
    return tier.rank_from === tier.rank_to
      ? t("plataforma.tesoroFicha.premios.rankSingle", { rank: tier.rank_from })
      : t("plataforma.tesoroFicha.premios.rankRange", { from: tier.rank_from, to: tier.rank_to });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button type="button" onClick={() => setEditing("new")}>
          {t("plataforma.tesoroFicha.premios.newTitle")}
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t("plataforma.tesoroFicha.premios.empty")} description={t("plataforma.tesoroFicha.premios.emptyHint")} />
      ) : (
        <Table
          caption={t("plataforma.tesoroFicha.premios.tableCaption")}
          rows={rows}
          getRowKey={(tier) => tier.id}
          columns={[
            { key: "rank", header: t("plataforma.tesoroFicha.premios.rankHeader"), render: rankText },
            { key: "name", header: t("plataforma.tesoroFicha.premios.name"), render: (tier) => tier.tier_name },
            { key: "description", header: t("plataforma.tesoroFicha.premios.description"), render: (tier) => tier.description || "—" },
            {
              key: "actions",
              header: <span className="sr-only">{t("common.actions")}</span>,
              render: (tier) => (
                <span className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setEditing(tier)}>
                    {t("plataforma.tesoroFicha.premios.edit")}
                  </Button>
                  <Button type="button" variant="danger" onClick={() => setDeleting(tier)}>
                    {t("plataforma.tesoroFicha.premios.delete")}
                  </Button>
                </span>
              ),
            },
          ]}
        />
      )}

      {editing ? (
        <TierForm
          key={editing === "new" ? "new" : editing.id}
          gameId={gameId}
          tiers={rows}
          editing={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title={t("plataforma.tesoroFicha.premios.deleteTitle")}
        description={
          <>
            <span>{t("plataforma.tesoroFicha.premios.deleteDescription", { name: deleting?.tier_name ?? "" })}</span>
            {remove.isError ? (
              <span role="alert" className="mt-2 block text-error">
                {errorKindText(remove.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK)}
              </span>
            ) : null}
          </>
        }
        confirmLabel={t("plataforma.tesoroFicha.premios.delete")}
        pending={remove.isPending}
        onCancel={closeDelete}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
