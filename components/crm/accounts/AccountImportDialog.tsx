"use client";

/**
 * Importar entidades desde CSV/XLSX: primero una vista previa (qué se
 * crearía, con errores y posibles duplicados por fila) y solo después el
 * alta. Nada se guarda hasta pulsar «Importar».
 */
import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Table } from "@/components/ui/Table";
import { useImportCommit, useImportPreview } from "@/hooks/useCrm";
import type { CrmImportRow } from "@/lib/api/crmTypes";

import { CrmUserSelect, crmLabelClass } from "../common";
import { MutationError } from "./shared";

function textOf(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function AccountImportDialog({ isManager, onClose }: { isManager: boolean; onClose: () => void }) {
  const t = useTranslations("crm.accounts.import");
  const tc = useTranslations("common");
  const titleId = useId();
  const preview = useImportPreview();
  const commit = useImportCommit();
  const [rows, setRows] = useState<CrmImportRow[] | null>(null);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [owner, setOwner] = useState<number | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  const withErrors = rows?.filter((row) => row.errors.length).length ?? 0;
  const withDuplicates = rows?.filter((row) => row.duplicates.length).length ?? 0;
  const pending = preview.isPending || commit.isPending;

  return (
    <Dialog open titleId={titleId} title={t("title")} onClose={onClose} pending={pending} widthClassName="max-w-3xl">
      <div className="flex flex-col gap-3">
        {result ? (
          <p role="status" className="text-sm text-text-base">
            {t("result", { created: result.created, skipped: result.skipped })}
          </p>
        ) : (
          <>
            <div>
              <label htmlFor="crm-import-file" className={crmLabelClass}>
                {t("file")}
              </label>
              <input
                id="crm-import-file"
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="text-sm"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setRows(null);
                  commit.reset();
                  if (file) preview.mutate(file, { onSuccess: setRows });
                }}
              />
              <p className="mt-1 text-xs text-text-secondary">{t("hint")}</p>
            </div>
            <MutationError error={preview.error} />
            {rows ? (
              <>
                <p className="text-sm text-text-base" role="status">
                  {t("summary", { count: rows.length, errors: withErrors, duplicates: withDuplicates })}
                </p>
                <div className="max-h-72 overflow-y-auto">
                  <Table
                    caption={t("caption")}
                    rows={rows}
                    getRowKey={(row) => String(row.row)}
                    columns={[
                      { key: "row", header: t("row"), render: (row) => row.row },
                      { key: "name", header: t("name"), render: (row) => textOf(row.data.name) || "—" },
                      {
                        key: "municipality",
                        header: t("municipality"),
                        render: (row) => row.place_name || textOf(row.data.municipality) || textOf(row.data.province_name) || "—",
                      },
                      {
                        key: "errors",
                        header: t("errors"),
                        render: (row) =>
                          row.errors.length ? <span className="text-error">{row.errors.join(" · ")}</span> : "—",
                      },
                      {
                        key: "duplicates",
                        header: t("duplicates"),
                        render: (row) => (row.duplicates.length ? row.duplicates.map((d) => textOf(d.name)).join(" · ") : "—"),
                      },
                    ]}
                  />
                </div>
                <label className="inline-flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={includeDuplicates} onChange={(e) => setIncludeDuplicates(e.target.checked)} />
                  {t("includeDuplicates")}
                </label>
                {isManager ? <CrmUserSelect id="crm-import-owner" label={t("owner")} value={owner} onChange={setOwner} allowEmpty /> : null}
                <MutationError error={commit.error} />
              </>
            ) : null}
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            {result ? tc("close") : tc("cancel")}
          </Button>
          {!result && rows ? (
            <Button
              type="button"
              disabled={pending || rows.length === 0}
              onClick={() =>
                commit.mutate(
                  { rows, owner, include_duplicates: includeDuplicates },
                  { onSuccess: setResult },
                )
              }
            >
              {commit.isPending ? t("importing") : t("submit")}
            </Button>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
