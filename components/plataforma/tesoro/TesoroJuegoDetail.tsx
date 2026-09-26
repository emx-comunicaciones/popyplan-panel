"use client";

/**
 * Ficha de un juego de la búsqueda del tesoro (admin de plataforma,
 * bloque 2): cabecera con nombre y estado, y seis pestañas con el mismo
 * selector de botones + `aria-pressed` que `EntidadDetail.tsx` (sin ARIA
 * tabs, como el resto del panel). Cada pestaña es su propio componente y
 * solo se monta la visible, así que solo pide lo suyo.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useTreasureGame } from "@/hooks/useTreasureHunt";
import { errorKindText } from "@/lib/i18n/errorKindText";

import { TesoroDatosTab } from "./TesoroDatosTab";
import { TesoroParticipantesTab } from "./TesoroParticipantesTab";
import { TesoroPremiosTab } from "./TesoroPremiosTab";
import { TesoroPruebasTab } from "./TesoroPruebasTab";
import { TesoroRankingTab } from "./TesoroRankingTab";
import { TesoroValidacionesTab } from "./TesoroValidacionesTab";
import { GameStatusBadge } from "./TesoroJuegosTable";
import { TREASURE_ERROR_FALLBACK, TREASURE_ERROR_KEYS } from "./shared";

const SECTIONS = ["datos", "pruebas", "premios", "participantes", "validaciones", "ranking"] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_LABEL_KEYS: Record<Section, string> = {
  datos: "plataforma.tesoroFicha.sections.datos",
  pruebas: "plataforma.tesoroFicha.sections.pruebas",
  premios: "plataforma.tesoroFicha.sections.premios",
  participantes: "plataforma.tesoroFicha.sections.participantes",
  validaciones: "plataforma.tesoroFicha.sections.validaciones",
  ranking: "plataforma.tesoroFicha.sections.ranking",
};

export function TesoroJuegoDetail({ gameId }: { gameId: string }) {
  const t = useTranslations();
  const game = useTreasureGame(gameId);
  const [section, setSection] = useState<Section>("datos");

  if (game.isError) {
    return game.error.kind === "no_encontrado" ? (
      <EmptyState title={t("plataforma.tesoroFicha.notFound")} />
    ) : (
      <ErrorState
        title={t("plataforma.tesoroFicha.loadError")}
        description={errorKindText(game.error, TREASURE_ERROR_KEYS, t, TREASURE_ERROR_FALLBACK)}
      />
    );
  }
  if (!game.data) {
    return <p className="text-sm text-text-secondary">{t("common.loading")}</p>;
  }

  const data = game.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-text-base">{data.name}</h2>
        <GameStatusBadge status={data.status} />
      </div>
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">{t("plataforma.tesoroFicha.sectionsLegend")}</legend>
        {SECTIONS.map((value) => (
          <Button
            key={value}
            type="button"
            variant={section === value ? "primary" : "secondary"}
            aria-pressed={section === value}
            onClick={() => setSection(value)}
          >
            {t(SECTION_LABEL_KEYS[value])}
          </Button>
        ))}
      </fieldset>
      {section === "datos" ? <TesoroDatosTab game={data} /> : null}
      {section === "pruebas" ? <TesoroPruebasTab gameId={data.id} /> : null}
      {section === "premios" ? <TesoroPremiosTab gameId={data.id} /> : null}
      {section === "participantes" ? <TesoroParticipantesTab gameId={data.id} gameStatus={data.status} /> : null}
      {section === "validaciones" ? <TesoroValidacionesTab gameId={data.id} /> : null}
      {section === "ranking" ? <TesoroRankingTab gameId={data.id} /> : null}
    </div>
  );
}
