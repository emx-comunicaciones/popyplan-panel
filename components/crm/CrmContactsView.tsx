"use client";

/**
 * Contactos del CRM (`/plataforma/comercial/contactos`): todas las
 * personas de las entidades que ve quien mira, con búsqueda, filtro por
 * departamento y exportación.
 */
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { EmailLink, PhoneLink, contactFullName } from "@/components/crm/accounts/shared";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { downloadCrmExport, useCrmCatalog, useCrmContacts } from "@/hooks/useCrm";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { CrmContact } from "@/lib/api/crmTypes";
import { formatDate } from "@/lib/crm/format";
import { crmAccountHref } from "@/lib/crm/nav";
import { errorKindText } from "@/lib/i18n/errorKindText";

import { CRM_ERROR_KEYS } from "./QuickActivityDialog";
import { crmInputClass, crmLabelClass } from "./common";

export interface CrmContactsViewProps {
  isManager: boolean;
  userId: number;
}

const PAGE_SIZE = 25;

export function CrmContactsView(props: CrmContactsViewProps) {
  void props;
  const t = useTranslations();
  const tc = useTranslations("crm.contacts");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [page, setPage] = useState(1);
  const [exportError, setExportError] = useState<unknown>(null);
  const q = useDebouncedValue(search, 300).trim();
  const departments = useCrmCatalog("department");
  const contacts = useCrmContacts({ q, department, page, page_size: PAGE_SIZE });

  async function exportCsv() {
    setExportError(null);
    try {
      await downloadCrmExport("contacts", { q, department });
    } catch (error) {
      setExportError(error);
    }
  }

  const count = contacts.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold text-text-base">{tc("title")}</h1>
        <div className="ml-auto">
          <Button type="button" variant="secondary" onClick={exportCsv}>
            {tc("export")}
          </Button>
        </div>
      </div>
      {exportError ? (
        <p role="alert" className="text-sm text-error">
          {errorKindText(exportError as never, CRM_ERROR_KEYS, t, "errors.crm.desconocido")}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="crm-contacts-q" className={crmLabelClass}>
            {tc("search")}
          </label>
          <input
            id="crm-contacts-q"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={crmInputClass}
          />
        </div>
        <div>
          <label htmlFor="crm-contacts-department" className={crmLabelClass}>
            {tc("department")}
          </label>
          <select
            id="crm-contacts-department"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setPage(1);
            }}
            className={crmInputClass}
          >
            <option value="">{tc("allDepartments")}</option>
            {departments.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {contacts.isLoading ? <p className="text-sm text-text-secondary">{t("crm.common.loading")}</p> : null}
      {contacts.isError ? (
        <ErrorState
          title={tc("loadError")}
          description={errorKindText(contacts.error, CRM_ERROR_KEYS, t, "errors.crm.desconocido")}
          action={<Button type="button" variant="secondary" onClick={() => contacts.refetch()}>{t("common.retry")}</Button>}
        />
      ) : null}
      {contacts.data && contacts.data.results.length === 0 ? <EmptyState title={tc("empty")} /> : null}
      {contacts.data && contacts.data.results.length > 0 ? (
        <>
          <p className="text-sm text-text-secondary" role="status">
            {tc("count", { count })}
          </p>
          <Table<CrmContact>
            caption={tc("caption")}
            rows={contacts.data.results}
            getRowKey={(row) => String(row.id)}
            columns={[
              { key: "name", header: tc("columns.name"), render: (row) => <span className="font-medium">{contactFullName(row)}</span> },
              { key: "position", header: tc("columns.position"), render: (row) => row.position || "—" },
              { key: "department", header: tc("columns.department"), render: (row) => row.department_name || "—" },
              {
                key: "account",
                header: tc("columns.account"),
                render: (row) =>
                  row.account ? (
                    <Link href={crmAccountHref(row.account)} className="text-primary-700 underline">
                      {row.account_name}
                    </Link>
                  ) : (
                    "—"
                  ),
              },
              { key: "phone", header: tc("columns.phone"), render: (row) => <PhoneLink value={row.phone || row.mobile} /> },
              { key: "email", header: tc("columns.email"), render: (row) => <EmailLink value={row.email} /> },
              { key: "last", header: tc("columns.lastContact"), render: (row) => formatDate(row.last_contact_at) },
              { key: "activities", header: tc("columns.activities"), render: (row) => row.activities_count },
            ]}
          />
          <nav aria-label={tc("pagination.label")} className="flex items-center justify-between gap-2">
            <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {tc("pagination.previous")}
            </Button>
            <span className="text-sm text-text-secondary">{tc("pagination.page", { page, pages })}</span>
            <Button type="button" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              {tc("pagination.next")}
            </Button>
          </nav>
        </>
      ) : null}
    </section>
  );
}
