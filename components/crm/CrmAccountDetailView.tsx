"use client";

/**
 * Ficha de una entidad del CRM (`/plataforma/comercial/entidades/[id]`).
 * La cabecera responde, de un vistazo, quién la lleva, cómo está y cuál
 * es el siguiente paso; el selector de secciones lleva al resto (resumen,
 * historial, contactos, oportunidades, tareas, documentos, datos y
 * contratación). Los botones de la cabecera crean todo lo que cuelga de
 * una entidad sin salir de ella.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";

import { DocumentDialog, MeetingDialog, NoteDialog, OpportunityDialog, TaskDialog, ContactDialog } from "@/components/crm/accounts/detail/AccountDialogs";
import { DataSection } from "@/components/crm/accounts/detail/DataSection";
import { ContactsSection, DocumentsSection, OpportunitiesSection, TasksSection } from "@/components/crm/accounts/detail/ListSections";
import { ProcurementSection } from "@/components/crm/accounts/detail/ProcurementSection";
import { SummarySection } from "@/components/crm/accounts/detail/SummarySection";
import { TimelineSection } from "@/components/crm/accounts/detail/TimelineSection";
import { DaysAgoText, QueryBoundary } from "@/components/crm/accounts/shared";
import { Button } from "@/components/ui/Button";
import { useCrmAccountSummary } from "@/hooks/useCrm";
import type { CrmAccountSummary } from "@/lib/api/crmTypes";
import { daysAgo, formatDateTime } from "@/lib/crm/format";
import { CRM_ACTIVITY_KIND_LABELS, crmLabel } from "@/lib/crm/labels";

import { InterestMeter, StageBadge } from "./common";
import { useCrmContext } from "./CrmShell";

export interface CrmAccountDetailViewProps {
  id: number;
  isManager: boolean;
  userId: number;
}

const SECTIONS = ["summary", "timeline", "contacts", "opportunities", "tasks", "documents", "data", "procurement"] as const;
type Section = (typeof SECTIONS)[number];
type DialogKind = "task" | "contact" | "opportunity" | "document" | "note" | "meeting";

function Header({
  summary,
  onDialog,
  onActivity,
}: {
  summary: CrmAccountSummary;
  onDialog: (kind: DialogKind) => void;
  onActivity: () => void;
}) {
  const t = useTranslations("crm.accountDetail.header");
  const root = useTranslations();
  const { account, next } = summary;
  const place = [account.place?.name, account.province || account.province_name, account.population != null ? t("population", { count: account.population }) : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <header className="flex flex-col gap-2 rounded-lg border border-border bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-text-base">{account.name}</h1>
        <StageBadge stage={account.stage} />
        <InterestMeter value={account.interest} />
        {account.is_client ? <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-text-base">{t("client")}</span> : null}
      </div>
      {place ? <p className="text-sm text-text-secondary">{place}</p> : null}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <div className="flex gap-1">
          <dt className="text-text-secondary">{t("owner")}</dt>
          <dd className="font-medium">{account.owner?.name ?? t("noOwner")}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-text-secondary">{t("lastActivity")}</dt>
          <dd className="font-medium">
            <DaysAgoText days={daysAgo(account.last_activity_at)} never={t("neverContacted")} />
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-text-secondary">{t("nextActivity")}</dt>
          <dd className="font-medium">
            {next ? t("nextValue", { kind: crmLabel(CRM_ACTIVITY_KIND_LABELS, next.kind, root) || next.title, date: formatDateTime(next.at) }) : <span className="text-error">{t("noNext")}</span>}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onActivity}>
          {t("newActivity")}
        </Button>
        <Button type="button" variant="secondary" onClick={() => onDialog("meeting")}>
          {t("scheduleMeeting")}
        </Button>
        <Button type="button" variant="secondary" onClick={() => onDialog("task")}>
          {t("createTask")}
        </Button>
        <Button type="button" variant="secondary" onClick={() => onDialog("contact")}>
          {t("addContact")}
        </Button>
        <Button type="button" variant="secondary" onClick={() => onDialog("opportunity")}>
          {t("createOpportunity")}
        </Button>
        <Button type="button" variant="secondary" onClick={() => onDialog("document")}>
          {t("uploadDocument")}
        </Button>
        <Button type="button" variant="secondary" onClick={() => onDialog("note")}>
          {t("addNote")}
        </Button>
      </div>
    </header>
  );
}

export function CrmAccountDetailView({ id, isManager, userId }: CrmAccountDetailViewProps) {
  const t = useTranslations("crm.accountDetail");
  const { openActivity } = useCrmContext();
  const query = useCrmAccountSummary(id);
  const [section, setSection] = useState<Section>("summary");
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const close = () => setDialog(null);

  return (
    <QueryBoundary query={query}>
      {(summary) => (
        <div className="flex flex-col gap-3">
          <Header
            summary={summary}
            onDialog={setDialog}
            onActivity={() => openActivity({ account: { id, name: summary.account.name } })}
          />
          <div role="group" aria-label={t("sectionsLabel")} className="flex flex-wrap gap-1">
            {SECTIONS.map((key) => (
              <Button
                key={key}
                type="button"
                variant={section === key ? "primary" : "secondary"}
                aria-pressed={section === key}
                onClick={() => setSection(key)}
              >
                {t(`sections.${key}`)}
              </Button>
            ))}
          </div>
          <div>
            {section === "summary" ? <SummarySection summary={summary} /> : null}
            {section === "timeline" ? <TimelineSection accountId={id} /> : null}
            {section === "contacts" ? <ContactsSection accountId={id} /> : null}
            {section === "opportunities" ? <OpportunitiesSection accountId={id} /> : null}
            {section === "tasks" ? <TasksSection accountId={id} /> : null}
            {section === "documents" ? <DocumentsSection accountId={id} /> : null}
            {section === "data" ? <DataSection account={summary.account} isManager={isManager} /> : null}
            {section === "procurement" ? <ProcurementSection accountId={id} /> : null}
          </div>
          {dialog === "task" ? <TaskDialog account={{ id }} isManager={isManager} userId={userId} onClose={close} /> : null}
          {dialog === "contact" ? <ContactDialog account={{ id }} onClose={close} /> : null}
          {dialog === "opportunity" ? <OpportunityDialog account={{ id }} onClose={close} /> : null}
          {dialog === "document" ? <DocumentDialog account={{ id }} onClose={close} /> : null}
          {dialog === "note" ? <NoteDialog account={{ id }} onClose={close} /> : null}
          {dialog === "meeting" ? <MeetingDialog account={{ id }} onClose={close} /> : null}
        </div>
      )}
    </QueryBoundary>
  );
}
