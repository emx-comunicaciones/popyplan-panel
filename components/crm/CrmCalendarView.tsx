"use client";

/**
 * Calendario (punto 23): día, semana o mes con las actividades, tareas y
 * renovaciones del rango. El mes es una cuadrícula con lunes primero; en
 * pantallas pequeñas se sustituye por una agenda (lista por días). Desde
 * un día se registra una actividad o se crea una tarea con esa fecha.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCrmCalendar } from "@/hooks/useCrm";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { CrmCalendarItem } from "@/lib/api/crmTypes";
import { CRM_ACTIVITY_KINDS, CRM_ACTIVITY_KIND_LABELS, crmLabel } from "@/lib/crm/labels";
import { crmAccountHref } from "@/lib/crm/nav";
import { activeLanguage, localeFor } from "@/lib/i18n/locale";

import { crmLabelClass } from "./common";
import { useCrmContext } from "./CrmShell";
import { TaskDialog } from "./work/TaskDialog";
import { CrmUserFilter, crmFilterInputClass, useCrmErrorText } from "./work/shared";

export interface CrmCalendarViewProps {
  isManager: boolean;
  userId: number;
}

type View = "day" | "week" | "month";
const VIEWS: { key: View; label: string }[] = [
  { key: "day", label: "crm.calendar.views.day" },
  { key: "week", label: "crm.calendar.views.week" },
  { key: "month", label: "crm.calendar.views.month" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));

/** Días que cubre la vista (el mes incluye los días sueltos del mes anterior y siguiente). */
export function calendarDays(view: View, anchor: Date): Date[] {
  if (view === "day") return [startOfDay(anchor)];
  if (view === "week") {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(last), 6);
  const total = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Array.from({ length: total }, (_, i) => addDays(start, i));
}

function move(view: View, anchor: Date, direction: 1 | -1): Date {
  if (view === "day") return addDays(anchor, direction);
  if (view === "week") return addDays(anchor, 7 * direction);
  return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
}

function ItemRow({ item, locale }: { item: CrmCalendarItem; locale: string }) {
  const t = useTranslations();
  const time =
    item.type === "renewal"
      ? ""
      : new Date(item.start).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const typeLabel =
    item.type === "task"
      ? t("crm.calendar.types.task")
      : item.type === "renewal"
        ? t("crm.calendar.types.renewal")
        : t("crm.calendar.types.activity");
  const text = (
    <>
      {time ? <span className="mr-1 tabular-nums">{time}</span> : null}
      <span>{item.title}</span>
    </>
  );
  const cls = item.done ? "text-text-secondary line-through" : "font-semibold text-text-base";
  return (
    <li className="rounded-md border border-border-light bg-white px-1.5 py-1 text-xs">
      {item.account ? (
        <Link href={crmAccountHref(item.account)} className={`${cls} underline decoration-primary-700`}>
          {text}
        </Link>
      ) : (
        <span className={cls}>{text}</span>
      )}
      <span className="block text-text-secondary">
        {typeLabel}
        {" · "}
        {crmLabel(CRM_ACTIVITY_KIND_LABELS, item.kind, t)}
        {item.account_name ? ` · ${item.account_name}` : ""}
        {item.done ? ` · ${t(item.type === "task" ? "crm.calendar.doneTask" : "crm.calendar.doneActivity")}` : ""}
      </span>
    </li>
  );
}

function DayActions({ onActivity, onTask }: { onActivity: () => void; onTask: () => void }) {
  const t = useTranslations();
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      <Button type="button" variant="secondary" onClick={onActivity}>
        {t("crm.calendar.addActivity")}
      </Button>
      <Button type="button" variant="secondary" onClick={onTask}>
        {t("crm.calendar.addTask")}
      </Button>
    </div>
  );
}

export function CrmCalendarView({ isManager, userId }: CrmCalendarViewProps) {
  const t = useTranslations();
  const errorText = useCrmErrorText();
  const { openActivity } = useCrmContext();
  const locale = localeFor(activeLanguage());
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [owner, setOwner] = useState<number | "">("");
  const [province, setProvince] = useState("");
  const [kind, setKind] = useState("");
  const [taskDate, setTaskDate] = useState<string | null>(null);
  const debouncedProvince = useDebouncedValue(province, 300).trim();

  const days = useMemo(() => calendarDays(view, anchor), [view, anchor]);
  const since = ymd(days[0]);
  const until = ymd(days[days.length - 1]);
  const calendar = useCrmCalendar({
    since,
    until,
    owner: isManager ? owner : "",
    province: debouncedProvince,
    activity_kind: kind,
  });

  const byDay = useMemo(() => {
    const map = new Map<string, CrmCalendarItem[]>();
    for (const item of calendar.data ?? []) {
      const key = ymd(new Date(item.start));
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [calendar.data]);

  const today = ymd(new Date());
  const rangeLabel =
    view === "month"
      ? anchor.toLocaleDateString(locale, { month: "long", year: "numeric" })
      : view === "week"
        ? `${days[0].toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`
        : anchor.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "short" }),
  );

  function goToDay(day: Date) {
    setAnchor(day);
    setView("day");
  }

  const dayLabel = (day: Date) =>
    day.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });

  const agendaDays = view === "week" ? days : days.filter((d) => (byDay.get(ymd(d)) ?? []).length > 0);

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold text-text-base">{t("pages.plataforma.comercialCalendario.title")}</h1>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-border-light p-2">
        <div role="group" aria-label={t("crm.calendar.viewLabel")} className="flex gap-1">
          {VIEWS.map(({ key, label }) => (
            <Button
              key={key}
              type="button"
              variant={view === key ? "primary" : "secondary"}
              aria-pressed={view === key}
              onClick={() => setView(key)}
            >
              {t(label)}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          <Button type="button" variant="secondary" onClick={() => setAnchor(move(view, anchor, -1))}>
            {t("crm.calendar.previous")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAnchor(startOfDay(new Date()))}>
            {t("crm.calendar.today")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAnchor(move(view, anchor, 1))}>
            {t("crm.calendar.next")}
          </Button>
        </div>
        {isManager ? (
          <CrmUserFilter
            id="crm-cal-f-owner"
            label={t("crm.calendar.filters.owner")}
            allLabel={t("crm.calendar.filters.allOwners")}
            value={owner}
            onChange={setOwner}
          />
        ) : null}
        <div>
          <label htmlFor="crm-cal-f-province" className={crmLabelClass}>
            {t("crm.calendar.filters.province")}
          </label>
          <input
            id="crm-cal-f-province"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className={crmFilterInputClass}
          />
        </div>
        <div>
          <label htmlFor="crm-cal-f-kind" className={crmLabelClass}>
            {t("crm.calendar.filters.kind")}
          </label>
          <select id="crm-cal-f-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={crmFilterInputClass}>
            <option value="">{t("crm.calendar.filters.allKinds")}</option>
            {CRM_ACTIVITY_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(CRM_ACTIVITY_KIND_LABELS[k])}
              </option>
            ))}
          </select>
        </div>
      </div>

      <h2 aria-live="polite" className="text-lg font-semibold capitalize text-text-base">
        {rangeLabel}
      </h2>

      {calendar.isError ? (
        <ErrorState title={t("crm.calendar.loadError")} description={errorText(calendar.error)} />
      ) : calendar.isLoading ? (
        <p role="status" className="text-sm text-text-secondary">
          {t("crm.common.loading")}
        </p>
      ) : view === "day" ? (
        <div role="group" aria-label={dayLabel(days[0])} className="rounded-lg border border-border bg-white p-3">
          {(byDay.get(ymd(days[0])) ?? []).length ? (
            <ul className="flex flex-col gap-1.5">
              {(byDay.get(ymd(days[0])) ?? []).map((item) => (
                <ItemRow key={`${item.type}-${item.id}`} item={item} locale={locale} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-secondary">{t("crm.calendar.emptyDay")}</p>
          )}
          <DayActions onActivity={() => openActivity()} onTask={() => setTaskDate(ymd(days[0]))} />
        </div>
      ) : (
        <>
          <div className={`hidden gap-1 sm:grid sm:grid-cols-7`}>
            {weekdays.map((name) => (
              <div key={name} className="px-1 text-xs font-semibold capitalize text-text-secondary">
                {name}
              </div>
            ))}
            {days.map((day) => {
              const key = ymd(day);
              const items = byDay.get(key) ?? [];
              const outside = view === "month" && day.getMonth() !== anchor.getMonth();
              return (
                <div
                  key={key}
                  role="group"
                  aria-label={dayLabel(day)}
                  className={`min-h-24 rounded-md border p-1 ${key === today ? "border-primary-700" : "border-border-light"} ${outside ? "bg-border-light" : "bg-white"}`}
                >
                  <button
                    type="button"
                    onClick={() => goToDay(day)}
                    aria-current={key === today ? "date" : undefined}
                    aria-label={t("crm.calendar.openDay", { day: dayLabel(day) })}
                    className={`rounded px-1 text-sm hover:bg-primary-100 ${key === today ? "font-bold text-primary-700" : outside ? "text-text-secondary" : "text-text-base"}`}
                  >
                    {day.getDate()}
                  </button>
                  {items.length ? (
                    <ul className="mt-1 flex flex-col gap-1">
                      {items.map((item) => (
                        <ItemRow key={`${item.type}-${item.id}`} item={item} locale={locale} />
                      ))}
                    </ul>
                  ) : null}
                  {view === "week" ? <DayActions onActivity={() => openActivity()} onTask={() => setTaskDate(key)} /> : null}
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:hidden">
            {agendaDays.length ? (
              agendaDays.map((day) => {
                const items = byDay.get(ymd(day)) ?? [];
                return (
                  <div key={ymd(day)} role="group" aria-label={dayLabel(day)} className="rounded-lg border border-border bg-white p-2">
                    <button
                      type="button"
                      onClick={() => goToDay(day)}
                      className="text-sm font-semibold capitalize text-primary-700 underline"
                    >
                      {dayLabel(day)}
                    </button>
                    {items.length ? (
                      <ul className="mt-1 flex flex-col gap-1">
                        {items.map((item) => (
                          <ItemRow key={`${item.type}-${item.id}`} item={item} locale={locale} />
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-text-secondary">{t("crm.calendar.emptyDay")}</p>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-text-secondary">{t("crm.calendar.emptyRange")}</p>
            )}
          </div>
        </>
      )}

      {taskDate ? (
        <TaskDialog presetDate={taskDate} isManager={isManager} userId={userId} onClose={() => setTaskDate(null)} />
      ) : null}
    </div>
  );
}
