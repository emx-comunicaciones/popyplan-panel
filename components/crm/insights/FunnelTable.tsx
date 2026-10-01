"use client";

import { useTranslations } from "next-intl";

import { formatMoney } from "@/lib/crm/format";
import type { CrmFunnelRow } from "@/lib/api/crmTypes";

import { useInsightFormat } from "./useInsightFormat";

/**
 * Embudo comercial: fases abiertas y ganada en orden, con barras
 * proporcionales (decorativas: la cifra está siempre en texto); perdidas y
 * en pausa, aparte, porque no son un paso del embudo.
 */
export function FunnelTable({
  rows,
  withBars = true,
  withReached = false,
}: {
  rows: CrmFunnelRow[];
  withBars?: boolean;
  withReached?: boolean;
}) {
  const t = useTranslations("crm.dashboard.funnel");
  const { int, pct, none } = useInsightFormat();
  const main = rows.filter((row) => row.kind === "open" || row.kind === "won");
  const aside = rows.filter((row) => row.kind === "lost" || row.kind === "paused");
  const max = Math.max(1, ...main.map((row) => row.count));
  const days = (value: number | null) => (value === null ? none : t("days", { count: value }));

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{t("caption")}</caption>
          <thead>
            <tr className="border-b border-border text-text-secondary">
              <th scope="col" className="px-3 py-1.5 font-semibold">{t("stage")}</th>
              <th scope="col" className="px-3 py-1.5 font-semibold">{t("count")}</th>
              <th scope="col" className="px-3 py-1.5 font-semibold">{t("amount")}</th>
              {withReached ? <th scope="col" className="px-3 py-1.5 font-semibold">{t("reached")}</th> : null}
              <th scope="col" className="px-3 py-1.5 font-semibold">{t("conversion")}</th>
              <th scope="col" className="px-3 py-1.5 font-semibold">{t("averageDays")}</th>
            </tr>
          </thead>
          <tbody>
            {main.map((row) => (
              <tr key={row.stage} className="border-b border-border-light">
                <th scope="row" className="px-3 py-1.5 font-medium text-text-base">
                  {row.name}
                </th>
                <td className="min-w-48 px-3 py-1.5 text-text-base">
                  <div className="flex items-center gap-2">
                    {withBars ? (
                      <span aria-hidden="true" className="block h-3 flex-1 rounded-sm bg-border-light">
                        <span
                          className="block h-3 rounded-sm"
                          style={{
                            width: `${row.count > 0 ? Math.max(2, (row.count * 100) / max) : 0}%`,
                            backgroundColor: row.color || "#1FB3AE",
                          }}
                        />
                      </span>
                    ) : null}
                    <span className="min-w-8 text-right font-semibold">{int(row.count)}</span>
                  </div>
                </td>
                <td className="px-3 py-1.5 text-text-base">{formatMoney(row.amount)}</td>
                {withReached ? <td className="px-3 py-1.5 text-text-base">{int(row.reached)}</td> : null}
                <td className="px-3 py-1.5 text-text-base">{pct(row.conversion)}</td>
                <td className="px-3 py-1.5 text-text-base">{days(row.average_days)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {aside.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("asideCaption")}</caption>
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th scope="col" className="px-3 py-1.5 font-semibold">{t("stage")}</th>
                <th scope="col" className="px-3 py-1.5 font-semibold">{t("count")}</th>
                <th scope="col" className="px-3 py-1.5 font-semibold">{t("amount")}</th>
              </tr>
            </thead>
            <tbody>
              {aside.map((row) => (
                <tr key={row.stage} className="border-b border-border-light">
                  <th scope="row" className="px-3 py-1.5 font-medium text-text-base">
                    {row.name}
                  </th>
                  <td className="px-3 py-1.5 text-text-base">{int(row.count)}</td>
                  <td className="px-3 py-1.5 text-text-base">{formatMoney(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
