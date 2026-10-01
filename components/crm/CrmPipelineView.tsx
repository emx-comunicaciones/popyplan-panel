"use client";

/**
 * Pipeline (Kanban) del CRM: una columna por fase, tarjetas de
 * oportunidades o de entidades, arrastrables con HTML5 DnD y con un
 * «Mover a…» equivalente para teclado y móvil. Perder pide motivo y
 * ganar registra el contrato (`opportunities/StageDialogs.tsx`).
 */
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { ErrorState } from "@/components/ui/ErrorState";
import {
  toCrmError,
  useCrmCatalog,
  useCrmPipeline,
  useCrmUsers,
  useUpdateAccount,
} from "@/hooks/useCrm";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { CrmError } from "@/hooks/useCrm";
import type { CrmStage } from "@/lib/api/crmTypes";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { formatMoney } from "@/lib/crm/format";

import { crmInputClass } from "./common";
import { useCrmContext } from "./CrmShell";
import { CRM_ERROR_KEYS } from "./QuickActivityDialog";
import { AccountKanbanCard, OpportunityKanbanCard } from "./pipeline/KanbanCards";
import { useStageChange } from "./opportunities/StageDialogs";

export interface CrmPipelineViewProps {
  isManager: boolean;
  userId: number;
}

type Mode = "opportunities" | "accounts";

interface Dragged {
  id: number;
  stageId: number;
}

export function CrmPipelineView({ isManager }: CrmPipelineViewProps) {
  const t = useTranslations("crm.pipeline");
  const tAll = useTranslations();
  const { openActivity } = useCrmContext();
  const [mode, setMode] = useState<Mode>("opportunities");
  const [owner, setOwner] = useState("");
  const [provinceInput, setProvinceInput] = useState("");
  const [product, setProduct] = useState("");
  const province = useDebouncedValue(provinceInput.trim(), 300);
  const [overStage, setOverStage] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const dragged = useRef<Dragged | null>(null);

  const pipeline = useCrmPipeline({ of: mode, owner, province, product });
  const users = useCrmUsers();
  const products = useCrmCatalog("product");
  const updateAccount = useUpdateAccount();
  const [movingAccount, setMovingAccount] = useState<number | null>(null);

  const stageChange = useStageChange((target, stage) =>
    setStatus(t("moved", { name: target.name, stage: stage.name })),
  );

  const columns = pipeline.data?.columns ?? [];
  const stages: CrmStage[] = columns.map((column) => column.stage);

  function moveTo(id: number, name: string, stageId: number, currentStageId: number, amount?: string) {
    const stage = stages.find((s) => s.id === stageId);
    if (!stage || stageId === currentStageId) return;
    setStatus("");
    if (mode === "opportunities") {
      stageChange.request({ id, name, amount }, stage);
      return;
    }
    stageChange.reset();
    setMovingAccount(id);
    updateAccount.mutate(
      { id, stage: stageId },
      {
        onSuccess: () => setStatus(t("moved", { name, stage: stage.name })),
        onSettled: () => setMovingAccount(null),
      },
    );
  }

  const error: CrmError | null = stageChange.error ?? (updateAccount.isError ? toCrmError(updateAccount.error) : null);

  function handleDrop(stageId: number) {
    const item = dragged.current;
    dragged.current = null;
    setOverStage(null);
    if (!item || item.stageId === stageId) return;
    const column = columns.find((c) => c.stage.id === item.stageId);
    const card = column?.cards.find((c) => c.id === item.id);
    if (!card) return;
    moveTo(item.id, card.name, stageId, item.stageId, "amount" in card ? card.amount : undefined);
  }

  const filterLabel = "mb-1 block text-xs font-medium text-text-form";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text-base">{tAll("pages.plataforma.comercialPipeline.title")}</h1>
        <div role="group" aria-label={t("modeLabel")} className="inline-flex gap-1">
          {(["opportunities", "accounts"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setStatus("");
              }}
              className={`min-h-8 rounded-md border px-3 text-sm font-medium ${
                mode === value
                  ? "border-primary-700 bg-primary-100 text-text-base"
                  : "border-border bg-white text-text-form hover:bg-border-light"
              }`}
            >
              {t(value === "opportunities" ? "modeOpportunities" : "modeAccounts")}
            </button>
          ))}
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => event.preventDefault()} aria-label={t("filters")}>
        {isManager ? (
          <div>
            <label htmlFor="crm-pipe-owner" className={filterLabel}>
              {t("ownerFilter")}
            </label>
            <select id="crm-pipe-owner" value={owner} onChange={(e) => setOwner(e.target.value)} className={`${crmInputClass} min-h-8`}>
              <option value="">{t("allOwners")}</option>
              {users.data?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label htmlFor="crm-pipe-province" className={filterLabel}>
            {t("province")}
          </label>
          <input id="crm-pipe-province" value={provinceInput} onChange={(e) => setProvinceInput(e.target.value)} className={`${crmInputClass} min-h-8`} />
        </div>
        <div>
          <label htmlFor="crm-pipe-product" className={filterLabel}>
            {t("product")}
          </label>
          <select id="crm-pipe-product" value={product} onChange={(e) => setProduct(e.target.value)} className={`${crmInputClass} min-h-8`}>
            <option value="">{t("allProducts")}</option>
            {products.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </form>

      <p className="text-xs text-text-secondary">{t("dragHint")}</p>
      <p role="status" className="min-h-4 text-sm text-text-base">
        {status}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-error">
          {errorKindText(error, CRM_ERROR_KEYS, tAll, "errors.crm.desconocido")}
        </p>
      ) : null}

      {pipeline.isLoading ? <p className="text-sm text-text-secondary">{tAll("crm.common.loading")}</p> : null}
      {pipeline.isError ? <ErrorState title={t("loadError")} /> : null}
      {pipeline.data && columns.length === 0 ? <p className="text-sm text-text-secondary">{t("noStages")}</p> : null}

      {pipeline.data ? (
        <div className="-mx-1 flex items-start gap-3 overflow-x-auto px-1 pb-2">
          {columns.map((column) => {
            const headingId = `crm-col-${column.stage.id}`;
            return (
              // Destino de soltar: el «Mover a…» de cada tarjeta es la alternativa de teclado.
              // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
              <section
                key={column.stage.id}
                aria-labelledby={headingId}
                onDragOver={(event) => {
                  if (!dragged.current) return;
                  event.preventDefault();
                  if (overStage !== column.stage.id) setOverStage(column.stage.id);
                }}
                onDragLeave={() => setOverStage((current) => (current === column.stage.id ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(column.stage.id);
                }}
                className={`flex w-72 shrink-0 flex-col gap-2 rounded-lg border bg-border-light p-2 ${
                  overStage === column.stage.id ? "border-primary-700" : "border-border"
                }`}
              >
                <header className="flex flex-col gap-0.5">
                  <h2 id={headingId} className="flex items-center gap-1.5 text-sm font-semibold text-text-base">
                    <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.stage.color || "#9AA5B1" }} />
                    {column.stage.name}
                  </h2>
                  <p className="text-xs text-text-secondary">
                    {t("columnSummary", { count: column.count, amount: formatMoney(column.amount) })}
                  </p>
                </header>
                {column.cards.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-2 text-xs text-text-secondary">{t("emptyColumn")}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {pipeline.data.of === "opportunities"
                      ? pipeline.data.columns
                          .find((c) => c.stage.id === column.stage.id)
                          ?.cards.map((card) => (
                            <OpportunityKanbanCard
                              key={card.id}
                              card={card}
                              stage={column.stage}
                              stages={stages}
                              moving={stageChange.movingId === card.id}
                              onDragStart={() => {
                                dragged.current = { id: card.id, stageId: column.stage.id };
                              }}
                              onDragEnd={() => {
                                dragged.current = null;
                                setOverStage(null);
                              }}
                              onMove={(stageId) => moveTo(card.id, card.name, stageId, column.stage.id, card.amount)}
                              onActivity={() =>
                                openActivity({ account: { id: card.account, name: card.account_name }, opportunity: card.id })
                              }
                            />
                          ))
                      : pipeline.data.columns
                          .find((c) => c.stage.id === column.stage.id)
                          ?.cards.map((card) => (
                            <AccountKanbanCard
                              key={card.id}
                              account={card}
                              stage={column.stage}
                              stages={stages}
                              moving={movingAccount === card.id}
                              onDragStart={() => {
                                dragged.current = { id: card.id, stageId: column.stage.id };
                              }}
                              onDragEnd={() => {
                                dragged.current = null;
                                setOverStage(null);
                              }}
                              onMove={(stageId) => moveTo(card.id, card.name, stageId, column.stage.id)}
                              onActivity={() => openActivity({ account: { id: card.id, name: card.name } })}
                            />
                          ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : null}
      {stageChange.dialog}
    </div>
  );
}
