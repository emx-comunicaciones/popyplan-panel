"use client";

/**
 * Historial de la ficha: línea de tiempo del más nuevo al más viejo,
 * con cada evento leído de su `payload` (una foto de lo que pasó, ver
 * `crm/services.py::record`). Solo se lee: el historial nunca se edita.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { useCrmTimeline } from "@/hooks/useCrm";
import type { CrmTimelineEvent } from "@/lib/api/crmTypes";
import { formatDate, formatDateTime, formatMoney } from "@/lib/crm/format";
import {
  CRM_ACTIVITY_KIND_LABELS,
  CRM_DOCUMENT_CATEGORY_LABELS,
  CRM_INTEREST_LABELS,
  CRM_LOST_REASON_LABELS,
  CRM_PROPOSAL_STATUS_LABELS,
  CRM_RESULT_LABELS,
  crmLabel,
} from "@/lib/crm/labels";

import { crmInputClass, crmLabelClass } from "../../common";
import { QueryBoundary } from "../shared";

const FILTERS = [
  { value: "", key: "all" },
  { value: "activity,activity_edited", key: "activities" },
  { value: "stage,interest,owner,created,updated", key: "changes" },
  { value: "contact", key: "contacts" },
  { value: "opportunity,amount,proposal,contract", key: "opportunities" },
  { value: "task", key: "tasks" },
  { value: "document", key: "documents" },
  { value: "note", key: "notes" },
] as const;

const KNOWN_KINDS = new Set([
  "created", "updated", "activity", "activity_edited", "stage", "interest", "owner", "contact", "opportunity",
  "amount", "proposal", "contract", "document", "note", "task", "deleted",
]);

type Payload = Record<string, unknown>;

const str = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");

interface Described {
  title: string;
  lines: string[];
  /** Cuerpo largo (resumen, nota) que se pinta aparte, respetando saltos de línea. */
  body?: string;
}

type T = ReturnType<typeof useTranslations>;

function describe(event: CrmTimelineEvent, t: T, root: (key: string) => string): Described {
  const p: Payload = event.payload ?? {};
  const lines: string[] = [];
  const opp = str(p.opportunity_name) || event.opportunity_name;
  if (opp) lines.push(t("lines.opportunity", { name: opp }));
  const none = t("lines.nobody");
  switch (event.kind) {
    case "activity":
    case "activity_edited": {
      const kind = crmLabel(CRM_ACTIVITY_KIND_LABELS, str(p.activity_kind), root);
      const title = str(p.title);
      const contacts = Array.isArray(p.contacts) ? (p.contacts as { name?: string; position?: string }[]) : [];
      if (contacts.length) {
        lines.push(
          t("lines.contacts", {
            names: contacts.map((c) => (c.position ? `${c.name} (${c.position})` : c.name)).join(", "),
          }),
        );
      }
      if (p.duration_minutes) lines.push(t("lines.duration", { minutes: Number(p.duration_minutes) }));
      if (str(p.result) && p.result !== "none") lines.push(t("lines.result", { result: crmLabel(CRM_RESULT_LABELS, str(p.result), root) }));
      if (str(p.result_text)) lines.push(str(p.result_text));
      if (str(p.interest_after)) lines.push(t("lines.interestAfter", { interest: crmLabel(CRM_INTEREST_LABELS, str(p.interest_after), root) }));
      const next = p.next_action as { title?: string; due_at?: string; assignee_name?: string } | null | undefined;
      if (next) {
        lines.push(t("lines.nextAction", { title: next.title || "—", date: formatDateTime(next.due_at), owner: next.assignee_name || none }));
      }
      if (event.kind === "activity_edited" && Array.isArray(p.fields)) {
        lines.push(t("lines.edited", { fields: fieldList(p.fields as string[], t) }));
      }
      return {
        title: t(event.kind === "activity" ? "kinds.activity" : "kinds.activity_edited", { kind: kind || "" }) + (title ? ` · ${title}` : ""),
        lines,
        body: str(p.summary) || undefined,
      };
    }
    case "stage": {
      lines.unshift(t("lines.stageChange", { from: str(p.from_stage) || none, to: str(p.to_stage) }));
      if (str(p.lost_reason)) lines.push(t("lines.lostReason", { reason: crmLabel(CRM_LOST_REASON_LABELS, str(p.lost_reason), root) }));
      if (str(p.lost_detail)) lines.push(str(p.lost_detail));
      return { title: t("kinds.stage"), lines };
    }
    case "interest":
      lines.unshift(
        t("lines.interestChange", {
          from: crmLabel(CRM_INTEREST_LABELS, str(p.from_interest), root) || none,
          to: crmLabel(CRM_INTEREST_LABELS, str(p.to_interest), root) || none,
        }),
      );
      return { title: t("kinds.interest"), lines };
    case "owner":
      lines.unshift(t("lines.ownerChange", { from: str(p.from_owner) || none, to: str(p.to_owner) || none }));
      return { title: t("kinds.owner"), lines };
    case "contact": {
      const action = str(p.action);
      lines.unshift(t("lines.contact", { name: str(p.position) ? `${str(p.contact)} (${str(p.position)})` : str(p.contact) }));
      return { title: t(action === "removed" ? "kinds.contactRemoved" : action === "updated" ? "kinds.contactUpdated" : "kinds.contactCreated"), lines };
    }
    case "opportunity":
      lines.length = 0;
      lines.push(t("lines.opportunityCreated", { name: str(p.name), stage: str(p.stage), amount: formatMoney(str(p.amount) || null) }));
      return { title: t("kinds.opportunity"), lines };
    case "amount":
      lines.push(t("lines.amountChange", { field: amountField(str(p.field), t), from: formatMoney(str(p.previous) || null), to: formatMoney(str(p.new) || null) }));
      return { title: t("kinds.amount"), lines };
    case "proposal":
      lines.push(t("lines.proposal", { number: str(p.number), version: str(p.version), amount: formatMoney(str(p.amount) || null), status: crmLabel(CRM_PROPOSAL_STATUS_LABELS, str(p.status), root) }));
      if (str(p.previous_status)) lines.push(t("lines.previousStatus", { status: crmLabel(CRM_PROPOSAL_STATUS_LABELS, str(p.previous_status), root) }));
      return { title: t("kinds.proposal"), lines };
    case "contract":
      if (str(p.action) === "updated") {
        lines.push(t("lines.contractUpdated", { fields: Array.isArray(p.fields) ? (p.fields as string[]).join(", ") : "" }));
        return { title: t("kinds.contractUpdated"), lines };
      }
      lines.push(t("lines.contractWon", { amount: formatMoney(str(p.amount) || null), date: formatDate(str(p.awarded_at)) }));
      return { title: t("kinds.contract"), lines };
    case "document":
      lines.unshift(t("lines.document", { name: str(p.name), category: crmLabel(CRM_DOCUMENT_CATEGORY_LABELS, str(p.category), root), version: str(p.version) }));
      if (p.received) lines.push(t("lines.received"));
      return { title: t("kinds.document"), lines };
    case "note": {
      const flags = [p.important ? t("lines.important") : "", p.pinned ? t("lines.pinned") : ""].filter(Boolean);
      if (flags.length) lines.push(flags.join(" · "));
      return { title: t("kinds.note"), lines, body: str(p.body) || undefined };
    }
    case "task": {
      const action = str(p.action);
      const title = action === "created" ? t("kinds.taskCreated") : action === "done" ? t("kinds.taskDone") : action === "cancelled" ? t("kinds.taskCancelled") : t("kinds.task");
      lines.unshift(str(p.title));
      if (action === "created") lines.push(t("lines.taskDue", { date: formatDateTime(str(p.due_at)), owner: str(p.assignee_name) || none }));
      return { title, lines };
    }
    case "created":
      lines.push(t("lines.created", { stage: str(p.stage), owner: str(p.owner) || none }));
      return { title: t("kinds.created"), lines };
    case "updated":
      if (str(p.related)) lines.push(t("lines.related", { name: str(p.related) }));
      else if (Array.isArray(p.fields)) lines.push(t("lines.updatedFields", { fields: fieldList(p.fields as string[], t) }));
      return { title: t("kinds.updated"), lines };
    case "deleted": {
      const what = str(p.what);
      const known = ["account", "opportunity", "activity", "note", "document"].includes(what);
      lines.push(t("lines.deleted", { what: known ? t(`lines.what.${what}`) : what, name: str(p.name) || str(p.title) }));
      return { title: t("kinds.deleted"), lines };
    }
    default:
      return { title: event.kind, lines };
  }
}

function fieldList(fields: string[], t: T): string {
  return fields.map((field) => (t.has(`fields.${field}`) ? t(`fields.${field}`) : field)).join(", ");
}

function amountField(field: string, t: T): string {
  return t.has(`fields.${field}`) ? t(`fields.${field}`) : field;
}

function TimelineEntry({ event }: { event: CrmTimelineEvent }) {
  const t = useTranslations("crm.accountDetail.timeline");
  const root = useTranslations();
  const known = KNOWN_KINDS.has(event.kind);
  const { title, lines, body } = describe(event, t, root);
  const actor = str(event.payload?.actor_name);
  return (
    <li className="rounded-md border border-border bg-white p-2 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium text-text-base">{known ? title : t("kinds.other")}</span>
        <time dateTime={event.occurred_at} className="text-text-secondary">
          {formatDateTime(event.occurred_at)}
        </time>
        {actor ? <span className="text-text-secondary">{t("by", { name: actor })}</span> : null}
      </div>
      {lines.length ? (
        <ul className="mt-1 flex flex-col gap-0.5">
          {lines.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      ) : null}
      {body ? <p className="mt-1 whitespace-pre-wrap">{body}</p> : null}
    </li>
  );
}

function TimelinePage({
  accountId,
  kind,
  page,
  last,
  onMore,
}: {
  accountId: number;
  kind: string;
  page: number;
  last: boolean;
  onMore: () => void;
}) {
  const t = useTranslations("crm.accountDetail.timeline");
  const query = useCrmTimeline(accountId, { kind, page, page_size: 20 });
  return (
    <QueryBoundary query={query}>
      {(data) => (
        <>
          {page === 1 && data.results.length === 0 ? <p className="text-sm text-text-secondary">{t("empty")}</p> : null}
          {data.results.length ? (
            <ul className="flex flex-col gap-2">
              {data.results.map((event) => (
                <TimelineEntry key={event.id} event={event} />
              ))}
            </ul>
          ) : null}
          {last && data.next ? (
            <div>
              <Button type="button" variant="secondary" onClick={onMore}>
                {t("more")}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </QueryBoundary>
  );
}

export function TimelineSection({ accountId }: { accountId: number }) {
  const t = useTranslations("crm.accountDetail.timeline");
  const [kind, setKind] = useState("");
  const [pages, setPages] = useState(1);
  return (
    <div className="flex flex-col gap-3">
      <div className="max-w-xs">
        <label htmlFor="crm-timeline-kind" className={crmLabelClass}>
          {t("filter")}
        </label>
        <select
          id="crm-timeline-kind"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setPages(1);
          }}
          className={crmInputClass}
        >
          {FILTERS.map((f) => (
            <option key={f.key} value={f.value}>
              {t(`filters.${f.key}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: pages }, (_, index) => (
          <TimelinePage
            key={`${kind}-${index + 1}`}
            accountId={accountId}
            kind={kind}
            page={index + 1}
            last={index + 1 === pages}
            onMore={() => setPages((p) => p + 1)}
          />
        ))}
      </div>
    </div>
  );
}
