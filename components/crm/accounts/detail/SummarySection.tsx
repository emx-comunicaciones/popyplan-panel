"use client";

/**
 * Resumen de la ficha: lo que hace falta saber antes de llamar —estado,
 * último contacto y qué pasó, próximo paso, quién habla con quién, qué
 * se ha enviado y cuánto puede valer—, sin abrir ninguna otra pestaña.
 */
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useUpdateTask } from "@/hooks/useCrm";
import type { CrmAccountSummary } from "@/lib/api/crmTypes";
import { daysAgo, formatDate, formatDateTime, formatMoney } from "@/lib/crm/format";
import {
  CRM_ACTIVITY_KIND_LABELS,
  CRM_DOCUMENT_CATEGORY_LABELS,
  CRM_PRIORITY_LABELS,
  CRM_RESULT_LABELS,
  crmLabel,
} from "@/lib/crm/labels";
import { crmOpportunityHref } from "@/lib/crm/nav";

import { InterestMeter, StageBadge } from "../../common";
import { DaysAgoText, EmailLink, MutationError, PhoneLink, contactFullName } from "../shared";

export function SummarySection({ summary }: { summary: CrmAccountSummary }) {
  const t = useTranslations();
  const ts = useTranslations("crm.accountDetail.summary");
  const update = useUpdateTask();
  const { account, last_activity: last, next } = summary;
  const nextText = next
    ? ts("nextValue", { title: next.title || crmLabel(CRM_ACTIVITY_KIND_LABELS, next.kind, t), date: formatDateTime(next.at), owner: next.owner_name })
    : null;
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card title={ts("status")}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-text-secondary">{ts("stage")}</dt>
          <dd><StageBadge stage={account.stage} /></dd>
          <dt className="text-text-secondary">{ts("interest")}</dt>
          <dd><InterestMeter value={account.interest} /></dd>
          <dt className="text-text-secondary">{ts("owner")}</dt>
          <dd>{account.owner?.name ?? "—"}</dd>
          <dt className="text-text-secondary">{ts("lastContact")}</dt>
          <dd><DaysAgoText days={daysAgo(account.last_activity_at)} /></dd>
          <dt className="text-text-secondary">{ts("nextFollowUp")}</dt>
          <dd>{nextText ?? <span className="font-medium text-error">{ts("noNext")}</span>}</dd>
          <dt className="text-text-secondary">{ts("openValue")}</dt>
          <dd>{formatMoney(summary.open_value)}</dd>
          <dt className="text-text-secondary">{ts("proposalsSent")}</dt>
          <dd>{summary.proposals_sent}</dd>
        </dl>
      </Card>

      <Card title={ts("lastActivity")}>
        {last ? (
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-medium text-text-base">
              {crmLabel(CRM_ACTIVITY_KIND_LABELS, last.kind, t)}
              {last.title ? ` · ${last.title}` : ""}
            </p>
            <p className="text-text-secondary">{formatDateTime(last.occurred_at)}</p>
            {last.contacts_detail?.length ? (
              <p>{ts("with", { names: last.contacts_detail.map((c) => c.name).join(", ") })}</p>
            ) : null}
            {last.summary ? <p className="whitespace-pre-wrap">{last.summary}</p> : null}
            {last.result && last.result !== "none" ? (
              <p>{ts("result", { result: crmLabel(CRM_RESULT_LABELS, last.result, t) })}</p>
            ) : null}
            {last.result_text ? <p className="whitespace-pre-wrap">{last.result_text}</p> : null}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">{ts("noActivity")}</p>
        )}
      </Card>

      <Card title={ts("mainContacts")}>
        {summary.main_contacts.length ? (
          <ul className="flex flex-col gap-2 text-sm">
            {summary.main_contacts.map((contact) => (
              <li key={contact.id}>
                <p className="font-medium text-text-base">{contactFullName(contact)}</p>
                {contact.position ? <p className="text-text-secondary">{contact.position}</p> : null}
                <p className="flex flex-wrap gap-x-3">
                  <PhoneLink value={contact.phone || contact.mobile} />
                  <EmailLink value={contact.email} />
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">{ts("noContacts")}</p>
        )}
      </Card>

      <Card title={ts("openOpportunities")}>
        {summary.open_opportunities.length ? (
          <>
            <ul className="flex flex-col gap-1 text-sm">
              {summary.open_opportunities.map((opp) => (
                <li key={opp.id} className="flex flex-wrap items-center gap-x-2">
                  <Link href={crmOpportunityHref(opp.id)} className="font-medium text-primary-700 underline">
                    {opp.name}
                  </Link>
                  <StageBadge stage={opp.stage_detail} />
                  <span>{formatMoney(opp.estimated_amount)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm font-medium">{ts("totalValue", { amount: formatMoney(summary.open_value) })}</p>
          </>
        ) : (
          <p className="text-sm text-text-secondary">{ts("noOpportunities")}</p>
        )}
      </Card>

      <Card title={ts("pendingTasks")}>
        {summary.pending_tasks.length ? (
          <ul className="flex flex-col gap-2 text-sm">
            {summary.pending_tasks.map((task) => (
              <li key={task.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-text-base">{task.title}</span>
                <span className={task.is_overdue ? "text-error" : "text-text-secondary"}>
                  {task.is_overdue ? ts("overdue", { date: formatDate(task.due_at) }) : formatDate(task.due_at)}
                </span>
                <span className="text-text-secondary">{crmLabel(CRM_PRIORITY_LABELS, task.priority, t)}</span>
                <Button
                  type="button"
                  variant="secondary"
                  className="ml-auto"
                  disabled={update.isPending}
                  aria-label={ts("completeTask", { title: task.title ?? "" })}
                  onClick={() => update.mutate({ id: task.id, status: "done" })}
                >
                  {ts("complete")}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">{ts("noTasks")}</p>
        )}
        <MutationError error={update.error} />
      </Card>

      <Card title={ts("notes")}>
        {summary.pinned_notes.length ? (
          <ul className="flex flex-col gap-2 text-sm">
            {summary.pinned_notes.map((note) => (
              <li
                key={note.id}
                className={`rounded-md border p-2 ${note.important ? "border-primary-700 bg-primary-100" : "border-border bg-white"}`}
              >
                {note.important ? <strong className="mr-1">{ts("important")}</strong> : null}
                <span className="whitespace-pre-wrap">{note.body}</span>
                <p className="mt-1 text-xs text-text-secondary">
                  {note.author_name} · {formatDate(note.created_at)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">{ts("noNotes")}</p>
        )}
      </Card>

      <Card title={ts("recentDocuments")}>
        {summary.recent_documents.length ? (
          <ul className="flex flex-col gap-1 text-sm">
            {summary.recent_documents.map((doc) => (
              <li key={doc.id}>
                <span className="font-medium text-text-base">{doc.name}</span>{" "}
                <span className="text-text-secondary">
                  {crmLabel(CRM_DOCUMENT_CATEGORY_LABELS, doc.category, t)} · {formatDate(doc.created_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">{ts("noDocuments")}</p>
        )}
      </Card>
    </div>
  );
}
