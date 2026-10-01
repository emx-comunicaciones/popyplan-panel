"use client";

/**
 * Documentos (puntos 18-19): repositorio con filtros, vista previa,
 * descarga, versiones (nunca se borran), subida y borrado lógico. Los
 * ficheros viajan siempre por la API con permiso, nunca por su URL.
 */
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import type { PickerOption } from "@/components/ui/SearchPicker";
import { Table } from "@/components/ui/Table";
import { openCrmDocument, useCrmDocuments, useDeleteDocument } from "@/hooks/useCrm";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { CrmDocument, CrmDocumentVersion } from "@/lib/api/crmTypes";
import { formatDate } from "@/lib/crm/format";
import { CRM_DOCUMENT_CATEGORIES, CRM_DOCUMENT_CATEGORY_LABELS, crmLabel } from "@/lib/crm/labels";
import { crmAccountHref, crmOpportunityHref } from "@/lib/crm/nav";

import { CrmAccountPicker, crmLabelClass } from "./common";
import { NewVersionDialog, UploadDocumentDialog, VersionsDialog } from "./work/DocumentDialogs";
import { CRM_PAGE_SIZE, Pager, crmFilterInputClass, useCrmErrorText } from "./work/shared";

export interface CrmDocumentsViewProps {
  isManager: boolean;
  userId: number;
}

const latestOf = (doc: CrmDocument) => doc.latest as unknown as CrmDocumentVersion | null;

export function CrmDocumentsView(props: CrmDocumentsViewProps) {
  void props;
  const t = useTranslations();
  const errorText = useCrmErrorText();
  const [category, setCategory] = useState("");
  const [account, setAccount] = useState<PickerOption | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [versioning, setVersioning] = useState<CrmDocument | null>(null);
  const [history, setHistory] = useState<CrmDocument | null>(null);
  const [deleting, setDeleting] = useState<CrmDocument | null>(null);
  const [openError, setOpenError] = useState(false);
  const debouncedQ = useDebouncedValue(q, 300).trim();

  const documents = useCrmDocuments({
    category,
    account: account?.id,
    q: debouncedQ,
    page,
    page_size: CRM_PAGE_SIZE,
  });
  const remove = useDeleteDocument();
  const rows = documents.data?.results ?? [];
  const count = documents.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / CRM_PAGE_SIZE));

  async function open(documentId: number, versionId: number, inline: boolean) {
    setOpenError(false);
    try {
      await openCrmDocument(documentId, versionId, inline);
    } catch {
      setOpenError(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text-base">{t("pages.plataforma.comercialDocumentos.title")}</h1>
        <Button type="button" onClick={() => setUploading(true)}>
          {t("crm.documents.uploadButton")}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-border-light p-2">
        <div>
          <label htmlFor="crm-doc-f-category" className={crmLabelClass}>
            {t("crm.documents.filters.category")}
          </label>
          <select
            id="crm-doc-f-category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className={crmFilterInputClass}
          >
            <option value="">{t("crm.documents.filters.allCategories")}</option>
            {CRM_DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(CRM_DOCUMENT_CATEGORY_LABELS[c])}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-48">
          <CrmAccountPicker
            id="crm-doc-f-account"
            label={t("crm.documents.filters.account")}
            value={account}
            onChange={(value) => {
              setAccount(value);
              setPage(1);
            }}
          />
        </div>
        <div className="min-w-40 flex-1">
          <label htmlFor="crm-doc-f-q" className={crmLabelClass}>
            {t("crm.documents.filters.search")}
          </label>
          <input
            id="crm-doc-f-q"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {openError ? (
        <p role="alert" className="text-sm text-error">
          {t("crm.documents.openError")}
        </p>
      ) : null}

      {documents.isLoading ? (
        <p role="status" className="text-sm text-text-secondary">
          {t("crm.common.loading")}
        </p>
      ) : documents.isError ? (
        <ErrorState title={t("crm.documents.loadError")} description={errorText(documents.error)} />
      ) : rows.length === 0 ? (
        <EmptyState title={t("crm.documents.empty")} description={t("crm.documents.emptyHint")} />
      ) : (
        <>
          <Table
            caption={t("crm.documents.caption")}
            getRowKey={(d) => String(d.id)}
            rows={rows}
            columns={[
              { key: "name", header: t("crm.documents.columns.name"), render: (d) => <span className="font-medium">{d.name}</span> },
              {
                key: "category",
                header: t("crm.documents.columns.category"),
                render: (d) => crmLabel(CRM_DOCUMENT_CATEGORY_LABELS, d.category, t),
              },
              {
                key: "account",
                header: t("crm.documents.columns.account"),
                render: (d) =>
                  d.account ? (
                    <Link href={crmAccountHref(d.account)} className="text-primary-700 underline">
                      {d.account_name}
                    </Link>
                  ) : (
                    t("crm.common.none")
                  ),
              },
              {
                key: "opportunity",
                header: t("crm.documents.columns.opportunity"),
                render: (d) =>
                  d.opportunity ? (
                    <Link href={crmOpportunityHref(d.opportunity)} className="text-primary-700 underline">
                      {d.opportunity_name}
                    </Link>
                  ) : (
                    t("crm.common.none")
                  ),
              },
              {
                key: "version",
                header: t("crm.documents.columns.version"),
                render: (d) => {
                  const latest = latestOf(d);
                  return latest ? t("crm.documents.version", { n: latest.version }) : t("crm.common.none");
                },
              },
              {
                key: "date",
                header: t("crm.documents.columns.date"),
                render: (d) => formatDate(latestOf(d)?.created_at ?? d.created_at),
              },
              {
                key: "by",
                header: t("crm.documents.columns.uploadedBy"),
                render: (d) => latestOf(d)?.uploaded_by_name || d.created_by_name || t("crm.common.none"),
              },
              {
                key: "direction",
                header: t("crm.documents.columns.direction"),
                render: (d) => (d.received ? t("crm.documents.received") : t("crm.documents.sent")),
              },
              {
                key: "actions",
                header: <span className="sr-only">{t("common.actions")}</span>,
                render: (d) => {
                  const latest = latestOf(d);
                  return (
                    <div className="flex flex-wrap gap-1">
                      {latest ? (
                        <>
                          <Button type="button" variant="secondary" onClick={() => open(d.id, latest.id, true)}>
                            {t("crm.documents.view")}
                          </Button>
                          <Button type="button" variant="secondary" onClick={() => open(d.id, latest.id, false)}>
                            {t("crm.documents.download")}
                          </Button>
                        </>
                      ) : null}
                      <Button type="button" variant="secondary" onClick={() => setVersioning(d)}>
                        {t("crm.documents.addVersion")}
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setHistory(d)}>
                        {t("crm.documents.history")}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          remove.reset();
                          setDeleting(d);
                        }}
                      >
                        {t("crm.documents.delete")}
                      </Button>
                    </div>
                  );
                },
              },
            ]}
          />
          <Pager
            page={page}
            count={count}
            onPage={setPage}
            labels={{
              previous: t("crm.documents.pager.previous"),
              next: t("crm.documents.pager.next"),
              summary: t("crm.documents.pager.summary", { page, pages, count }),
            }}
          />
        </>
      )}

      {uploading ? <UploadDocumentDialog onClose={() => setUploading(false)} /> : null}
      {versioning ? (
        <NewVersionDialog key={versioning.id} document={versioning} onClose={() => setVersioning(null)} />
      ) : null}
      {history ? (
        <VersionsDialog
          document={history}
          onDownload={(versionId) => open(history.id, versionId, false)}
          onClose={() => setHistory(null)}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        title={t("crm.documents.deleteTitle")}
        description={
          <>
            <p>{t("crm.documents.deleteBody", { name: deleting?.name ?? "" })}</p>
            {remove.isError ? (
              <p role="alert" className="mt-2 text-error">
                {errorText(remove.error)}
              </p>
            ) : null}
          </>
        }
        confirmLabel={t("crm.documents.deleteConfirm")}
        pending={remove.isPending}
        onCancel={() => {
          remove.reset();
          setDeleting(null);
        }}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
