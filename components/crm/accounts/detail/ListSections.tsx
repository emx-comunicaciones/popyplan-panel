"use client";

/**
 * Pestañas de listas de la ficha: contactos, oportunidades, tareas y
 * documentos. Cada una pide solo lo suyo cuando se abre.
 */
import Link from "next/link";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table } from "@/components/ui/Table";
import {
  openCrmDocument,
  useAddDocumentVersion,
  useCrmAccountContacts,
  useCrmDocuments,
  useCrmOpportunities,
  useCrmTasks,
  useDeleteContact,
  useDeleteDocument,
  useUpdateTask,
  type CrmError,
  toCrmError,
} from "@/hooks/useCrm";
import type { CrmContact, CrmDocument, CrmDocumentVersion, CrmOpportunity, CrmTask } from "@/lib/api/crmTypes";
import { formatDate, formatDateTime, formatMoney } from "@/lib/crm/format";
import {
  CRM_ACTIVITY_KIND_LABELS,
  CRM_DOCUMENT_CATEGORY_LABELS,
  CRM_PRIORITY_LABELS,
  CRM_TASK_STATUS_LABELS,
  crmLabel,
} from "@/lib/crm/labels";
import { crmOpportunityHref } from "@/lib/crm/nav";

import { StageBadge } from "../../common";
import { ContactDialog } from "./AccountDialogs";
import { EmailLink, FormDialog, MutationError, PageNav, PhoneLink, QueryBoundary, contactFullName, pageCount, useBackOnMissingPage } from "../shared";

const LIST_PAGE_SIZE = 50;
const DONE_PAGE_SIZE = 20;

// ─── Contactos ──────────────────────────────────────────────────────────────

export function ContactsSection({ accountId }: { accountId: number }) {
  const t = useTranslations("crm.accountDetail.contacts");
  const query = useCrmAccountContacts(accountId);
  const del = useDeleteContact();
  const [editing, setEditing] = useState<CrmContact | null>(null);
  const [deleting, setDeleting] = useState<CrmContact | null>(null);
  return (
    <QueryBoundary query={query}>
      {(contacts) =>
        contacts.length === 0 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <>
            <Table<CrmContact>
              caption={t("caption")}
              rows={contacts}
              getRowKey={(row) => String(row.id)}
              columns={[
                {
                  key: "name",
                  header: t("name"),
                  render: (row) => (
                    <span className="font-medium">
                      {contactFullName(row)}
                      {row.is_primary ? <span className="ml-1 text-xs text-primary-700">{t("primary")}</span> : null}
                    </span>
                  ),
                },
                { key: "position", header: t("position"), render: (row) => [row.position, row.department_name].filter(Boolean).join(" · ") || "—" },
                { key: "phone", header: t("phone"), render: (row) => (
                  <span className="flex flex-col">
                    <PhoneLink value={row.phone} />
                    {row.mobile ? <PhoneLink value={row.mobile} /> : null}
                  </span>
                ) },
                { key: "email", header: t("email"), render: (row) => <EmailLink value={row.email} /> },
                { key: "last", header: t("lastContact"), render: (row) => formatDate(row.last_contact_at) },
                {
                  key: "actions",
                  header: <span className="sr-only">{t("actions")}</span>,
                  render: (row) => (
                    <span className="flex gap-2">
                      <Button type="button" variant="secondary" aria-label={t("editLabel", { name: contactFullName(row) })} onClick={() => setEditing(row)}>
                        {t("edit")}
                      </Button>
                      <Button type="button" variant="secondary" aria-label={t("deleteLabel", { name: contactFullName(row) })} onClick={() => { del.reset(); setDeleting(row); }}>
                        {t("delete")}
                      </Button>
                    </span>
                  ),
                },
              ]}
            />
            {editing ? <ContactDialog key={editing.id} account={{ id: accountId }} contact={editing} onClose={() => setEditing(null)} /> : null}
            <ConfirmDialog
              open={!!deleting}
              title={t("deleteTitle")}
              description={
                <>
                  <span>{t("deleteDescription", { name: deleting ? contactFullName(deleting) : "" })}</span>
                  <MutationError error={del.error} />
                </>
              }
              confirmLabel={t("delete")}
              pending={del.isPending}
              onCancel={() => { del.reset(); setDeleting(null); }}
              onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
            />
          </>
        )
      }
    </QueryBoundary>
  );
}

// ─── Oportunidades ──────────────────────────────────────────────────────────

export function OpportunitiesSection({ accountId }: { accountId: number }) {
  const t = useTranslations("crm.accountDetail.opportunities");
  const [page, setPage] = useState(1);
  const query = useCrmOpportunities({ account: accountId, page, page_size: LIST_PAGE_SIZE });
  useBackOnMissingPage(query, page, setPage);
  return (
    <QueryBoundary query={query}>
      {(data) =>
        data.results.length === 0 && page === 1 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <>
            <Table<CrmOpportunity>
              caption={t("caption")}
              rows={data.results}
              getRowKey={(row) => String(row.id)}
              columns={[
                {
                  key: "name",
                  header: t("name"),
                  render: (row) => (
                    <Link href={crmOpportunityHref(row.id)} className="font-medium text-primary-700 underline">
                      {row.name}
                    </Link>
                  ),
                },
                { key: "product", header: t("product"), render: (row) => row.product_name || "—" },
                { key: "stage", header: t("stage"), render: (row) => <StageBadge stage={row.stage_detail} /> },
                { key: "amount", header: t("amount"), render: (row) => formatMoney(row.estimated_amount) },
                { key: "close", header: t("expectedClose"), render: (row) => formatDate(row.expected_close_date) },
              ]}
            />
          <PageNav page={page} pages={pageCount(data.count, LIST_PAGE_SIZE)} onPage={setPage} />
          </>
        )
      }
    </QueryBoundary>
  );
}

// ─── Tareas ─────────────────────────────────────────────────────────────────

function TaskTable({ tasks, canAct }: { tasks: CrmTask[]; canAct: boolean }) {
  const t = useTranslations("crm.accountDetail.tasks");
  const root = useTranslations();
  const update = useUpdateTask();
  return (
    <>
      <MutationError error={update.error} />
      <Table<CrmTask>
        caption={canAct ? t("openCaption") : t("doneCaption")}
        rows={tasks}
        getRowKey={(row) => String(row.id)}
        columns={[
          { key: "title", header: t("task"), render: (row) => <span className="font-medium">{row.title}</span> },
          { key: "kind", header: t("kind"), render: (row) => crmLabel(CRM_ACTIVITY_KIND_LABELS, row.kind, root) || "—" },
          {
            key: "due",
            header: canAct ? t("due") : t("completed"),
            render: (row) => (
              <span className={row.is_overdue && canAct ? "text-error" : undefined}>
                {formatDateTime(canAct ? row.due_at : row.completed_at)}
              </span>
            ),
          },
          { key: "priority", header: t("priority"), render: (row) => crmLabel(CRM_PRIORITY_LABELS, row.priority, root) },
          { key: "assignee", header: t("assignee"), render: (row) => row.assignee_detail?.name ?? "—" },
          {
            key: "status",
            header: canAct ? <span className="sr-only">{t("actions")}</span> : t("status"),
            render: (row) =>
              canAct ? (
                <span className="flex gap-2">
                  <Button type="button" variant="secondary" disabled={update.isPending} aria-label={t("completeLabel", { title: row.title ?? "" })} onClick={() => update.mutate({ id: row.id, status: "done" })}>
                    {t("complete")}
                  </Button>
                  <Button type="button" variant="secondary" disabled={update.isPending} aria-label={t("cancelLabel", { title: row.title ?? "" })} onClick={() => update.mutate({ id: row.id, status: "cancelled" })}>
                    {t("cancel")}
                  </Button>
                </span>
              ) : (
                crmLabel(CRM_TASK_STATUS_LABELS, row.status, root)
              ),
          },
        ]}
      />
    </>
  );
}

export function TasksSection({ accountId }: { accountId: number }) {
  const t = useTranslations("crm.accountDetail.tasks");
  const [openPage, setOpenPage] = useState(1);
  const [donePage, setDonePage] = useState(1);
  const open = useCrmTasks({ account: accountId, mine: "false", bucket: "open", page: openPage, page_size: LIST_PAGE_SIZE });
  const done = useCrmTasks({ account: accountId, mine: "false", bucket: "done", page: donePage, page_size: DONE_PAGE_SIZE });
  useBackOnMissingPage(open, openPage, setOpenPage);
  useBackOnMissingPage(done, donePage, setDonePage);
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="crm-tasks-open" className="flex flex-col gap-2">
        <h2 id="crm-tasks-open" className="text-base font-semibold text-text-base">{t("openTitle")}</h2>
        <QueryBoundary query={open}>
          {(data) =>
            data.results.length || openPage > 1 ? (
              <>
                <TaskTable tasks={data.results} canAct />
                <PageNav page={openPage} pages={pageCount(data.count, LIST_PAGE_SIZE)} onPage={setOpenPage} />
              </>
            ) : (
              <EmptyState title={t("emptyOpen")} />
            )
          }
        </QueryBoundary>
      </section>
      <section aria-labelledby="crm-tasks-done" className="flex flex-col gap-2">
        <h2 id="crm-tasks-done" className="text-base font-semibold text-text-base">{t("doneTitle")}</h2>
        <QueryBoundary query={done}>
          {(data) =>
            data.results.length || donePage > 1 ? (
              <>
                <TaskTable tasks={data.results} canAct={false} />
                <PageNav page={donePage} pages={pageCount(data.count, DONE_PAGE_SIZE)} onPage={setDonePage} />
              </>
            ) : (
              <EmptyState title={t("emptyDone")} />
            )
          }
        </QueryBoundary>
      </section>
    </div>
  );
}

// ─── Documentos ─────────────────────────────────────────────────────────────

const latestOf = (doc: CrmDocument): CrmDocumentVersion | null => (doc.latest as CrmDocumentVersion | null) ?? null;

function VersionDialog({ document, onClose }: { document: CrmDocument; onClose: () => void }) {
  const t = useTranslations("crm.accountDetail.documents");
  const add = useAddDocumentVersion();
  const [file, setFile] = useState<File | null>(null);
  return (
    <FormDialog
      title={t("versionTitle", { name: document.name })}
      onClose={onClose}
      pending={add.isPending}
      error={add.error}
      canSubmit={!!file}
      submitLabel={t("upload")}
      onSubmit={() => file && add.mutate({ id: document.id, file }, { onSuccess: onClose })}
    >
      <div>
        <label htmlFor="crm-version-file" className="mb-1 block text-sm font-medium text-text-form">
          {t("file")}
        </label>
        <input id="crm-version-file" type="file" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
    </FormDialog>
  );
}

export function DocumentsSection({ accountId }: { accountId: number }) {
  const t = useTranslations("crm.accountDetail.documents");
  const root = useTranslations();
  const [page, setPage] = useState(1);
  const query = useCrmDocuments({ account: accountId, page, page_size: LIST_PAGE_SIZE });
  useBackOnMissingPage(query, page, setPage);
  const del = useDeleteDocument();
  const [versioning, setVersioning] = useState<CrmDocument | null>(null);
  const [deleting, setDeleting] = useState<CrmDocument | null>(null);
  const [fileError, setFileError] = useState<CrmError | null>(null);
  const busy = useRef(false);

  async function open(doc: CrmDocument, inline: boolean) {
    const latest = latestOf(doc);
    if (!latest || busy.current) return;
    busy.current = true;
    setFileError(null);
    try {
      await openCrmDocument(doc.id, latest.id, inline);
    } catch (error) {
      setFileError(toCrmError(error));
    } finally {
      busy.current = false;
    }
  }

  return (
    <QueryBoundary query={query}>
      {(data) =>
        data.results.length === 0 && page === 1 ? (
          <EmptyState title={t("empty")} />
        ) : (
          <>
            <MutationError error={fileError} />
            <Table<CrmDocument>
              caption={t("caption")}
              rows={data.results}
              getRowKey={(row) => String(row.id)}
              columns={[
                { key: "name", header: t("name"), render: (row) => <span className="font-medium">{row.name}</span> },
                { key: "category", header: t("category"), render: (row) => crmLabel(CRM_DOCUMENT_CATEGORY_LABELS, row.category, root) },
                { key: "version", header: t("version"), render: (row) => latestOf(row)?.version ?? "—" },
                { key: "date", header: t("date"), render: (row) => formatDate(latestOf(row)?.created_at ?? row.created_at) },
                { key: "by", header: t("uploadedBy"), render: (row) => latestOf(row)?.uploaded_by_name || row.created_by_name || "—" },
                {
                  key: "actions",
                  header: <span className="sr-only">{t("actions")}</span>,
                  render: (row) => (
                    <span className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" aria-label={t("viewLabel", { name: row.name })} onClick={() => open(row, true)}>
                        {t("view")}
                      </Button>
                      <Button type="button" variant="secondary" aria-label={t("downloadLabel", { name: row.name })} onClick={() => open(row, false)}>
                        {t("download")}
                      </Button>
                      <Button type="button" variant="secondary" aria-label={t("newVersionLabel", { name: row.name })} onClick={() => setVersioning(row)}>
                        {t("newVersion")}
                      </Button>
                      <Button type="button" variant="secondary" aria-label={t("deleteLabel", { name: row.name })} onClick={() => { del.reset(); setDeleting(row); }}>
                        {t("delete")}
                      </Button>
                    </span>
                  ),
                },
              ]}
            />
            <PageNav page={page} pages={pageCount(data.count, LIST_PAGE_SIZE)} onPage={setPage} />
            {versioning ? <VersionDialog key={versioning.id} document={versioning} onClose={() => setVersioning(null)} /> : null}
            <ConfirmDialog
              open={!!deleting}
              title={t("deleteTitle")}
              description={
                <>
                  <span>{t("deleteDescription", { name: deleting?.name ?? "" })}</span>
                  <MutationError error={del.error} />
                </>
              }
              confirmLabel={t("delete")}
              pending={del.isPending}
              onCancel={() => { del.reset(); setDeleting(null); }}
              onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
            />
          </>
        )
      }
    </QueryBoundary>
  );
}
