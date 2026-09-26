"use client";

/**
 * Pestaña «Ranking» de la ficha de un juego (`GET .../ranking/`): una fila
 * por equipo listo para jugar (en esta versión, uno por persona), con el
 * desempate del backend (terminó antes). Solo lectura.
 */
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useTreasureRanking } from "@/hooks/useTreasureHunt";
import { errorKindText } from "@/lib/i18n/errorKindText";

import { TREASURE_ERROR_FALLBACK, TREASURE_ERROR_KEYS, formatDateTime } from "./shared";

export function TesoroRankingTab({ gameId }: { gameId: string }) {
  const t = useTranslations();
  const ranking = useTreasureRanking(gameId);

  if (ranking.isError) {
    return (
      <ErrorState
        title={t("plataforma.tesoroFicha.ranking.loadError")}
        description={errorKindText(ranking.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK)}
      />
    );
  }
  if (!ranking.data) {
    return <p className="text-sm text-text-secondary">{t("common.loading")}</p>;
  }
  if (ranking.data.length === 0) {
    return <EmptyState title={t("plataforma.tesoroFicha.ranking.empty")} description={t("plataforma.tesoroFicha.ranking.emptyHint")} />;
  }
  return (
    <Table
      caption={t("plataforma.tesoroFicha.ranking.tableCaption")}
      rows={ranking.data}
      getRowKey={(row) => row.team_id}
      columns={[
        { key: "rank", header: t("plataforma.tesoroFicha.ranking.rankHeader"), render: (row) => (row.rank ?? "—").toString() },
        { key: "name", header: t("plataforma.tesoroFicha.ranking.nameHeader"), render: (row) => row.team_name },
        { key: "score", header: t("plataforma.tesoroFicha.ranking.scoreHeader"), render: (row) => String(row.score ?? 0) },
        { key: "steps", header: t("plataforma.tesoroFicha.ranking.stepsHeader"), render: (row) => String(row.steps_completed) },
        { key: "finished", header: t("plataforma.tesoroFicha.ranking.finishedHeader"), render: (row) => formatDateTime(row.finished_at) },
      ]}
    />
  );
}
