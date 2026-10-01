"use client";

/**
 * Tarjetas del Kanban. Cada una es arrastrable (HTML5 DnD) y lleva además
 * un «Mover a…» con teclado/móvil que hace lo mismo (alternativa
 * obligatoria de accesibilidad).
 */
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import type { CrmAccount, CrmOpportunityCard, CrmStage } from "@/lib/api/crmTypes";
import { crmAccountHref, crmOpportunityHref } from "@/lib/crm/nav";
import { formatDate, formatMoney } from "@/lib/crm/format";

import { InterestMeter } from "../common";

interface ShellProps {
  name: string;
  stages: CrmStage[];
  currentStageId: number;
  moving: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (stageId: number) => void;
  onActivity: () => void;
  children: ReactNode;
}

function CardShell({ name, stages, currentStageId, moving, onDragStart, onDragEnd, onMove, onActivity, children }: ShellProps) {
  const t = useTranslations("crm.pipeline");
  return (
    // Arrastrable: el «Mover a…» de abajo es la alternativa de teclado.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <li
      draggable
      aria-busy={moving}
      onDragStart={(event) => {
        // Firefox/Safari no arrancan el arrastre sin datos en `dataTransfer`.
        event.dataTransfer?.setData("text/plain", name);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`flex cursor-grab flex-col gap-1 rounded-md border border-border bg-white p-2 text-sm active:cursor-grabbing ${moving ? "opacity-60" : ""}`}
    >
      {children}
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <select
          aria-label={t("moveAria", { name })}
          value=""
          onChange={(event) => {
            if (event.target.value) onMove(Number(event.target.value));
          }}
          className="min-h-8 min-w-0 flex-1 rounded-md border border-border bg-white px-1.5 text-sm"
        >
          <option value="">{t("moveTo")}</option>
          {stages
            .filter((stage) => stage.id !== currentStageId)
            .map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
        </select>
        <Button type="button" variant="secondary" onClick={onActivity}>
          {t("registerActivity")}
        </Button>
      </div>
    </li>
  );
}

function Contact({ days, next }: { days: number | null; next: string | null }) {
  const t = useTranslations("crm.pipeline");
  return (
    <>
      <p className="text-xs text-text-secondary">
        {days === null ? t("neverContacted") : t("lastContact", { count: days })}
      </p>
      <p className="text-xs text-text-secondary">
        {next ? t("nextActivity", { date: formatDate(next) }) : t("noNextActivity")}
      </p>
    </>
  );
}

const linkClass = "font-semibold text-primary-700 underline-offset-2 hover:underline";

export function OpportunityKanbanCard({
  card,
  stage,
  stages,
  moving,
  onDragStart,
  onDragEnd,
  onMove,
  onActivity,
}: {
  card: CrmOpportunityCard;
  stage: CrmStage;
  stages: CrmStage[];
  moving: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (stageId: number) => void;
  onActivity: () => void;
}) {
  const t = useTranslations("crm.pipeline");
  const place = [card.municipality, card.province].filter(Boolean).join(" · ");
  return (
    <CardShell
      name={card.name}
      stages={stages}
      currentStageId={stage.id}
      moving={moving}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMove={onMove}
      onActivity={onActivity}
    >
      <Link href={crmAccountHref(card.account)} className="text-xs font-medium text-primary-700 hover:underline">
        {card.account_name}
      </Link>
      <Link href={crmOpportunityHref(card.id)} className={linkClass}>
        {card.name}
      </Link>
      {place ? <p className="text-xs text-text-secondary">{place}</p> : null}
      {card.population ? <p className="text-xs text-text-secondary">{t("population", { count: card.population })}</p> : null}
      <p className="text-xs text-text-secondary">{t("owner", { name: card.owner_name || "—" })}</p>
      <p className="text-sm font-semibold text-text-base">{formatMoney(card.amount)}</p>
      <InterestMeter value={card.interest} />
      <Contact days={card.days_without_contact} next={card.next_activity_at} />
    </CardShell>
  );
}

export function AccountKanbanCard({
  account,
  stage,
  stages,
  moving,
  onDragStart,
  onDragEnd,
  onMove,
  onActivity,
}: {
  account: CrmAccount;
  stage: CrmStage;
  stages: CrmStage[];
  moving: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (stageId: number) => void;
  onActivity: () => void;
}) {
  const t = useTranslations("crm.pipeline");
  const place = [account.place?.name, account.province].filter(Boolean).join(" · ");
  return (
    <CardShell
      name={account.name}
      stages={stages}
      currentStageId={stage.id}
      moving={moving}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMove={onMove}
      onActivity={onActivity}
    >
      <Link href={crmAccountHref(account.id)} className={linkClass}>
        {account.name}
      </Link>
      {place ? <p className="text-xs text-text-secondary">{place}</p> : null}
      {account.population ? <p className="text-xs text-text-secondary">{t("population", { count: account.population })}</p> : null}
      <p className="text-xs text-text-secondary">{t("owner", { name: account.owner?.name ?? "—" })}</p>
      <p className="text-sm font-semibold text-text-base">{t("openValue", { amount: formatMoney(account.open_value) })}</p>
      <InterestMeter value={account.interest} />
      <Contact days={account.days_without_contact} next={account.next_activity_at ?? null} />
    </CardShell>
  );
}
