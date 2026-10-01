"use client";

/**
 * Diálogos del repositorio de documentos: subir uno nuevo, añadir una
 * versión y ver el historial de versiones (las versiones nunca se borran).
 */
import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { PickerOption } from "@/components/ui/SearchPicker";
import { useAddDocumentVersion, useUploadDocument } from "@/hooks/useCrm";
import type { CrmDocument, CrmDocumentVersion } from "@/lib/api/crmTypes";
import { formatDateTime } from "@/lib/crm/format";
import { CRM_DOCUMENT_CATEGORIES, CRM_DOCUMENT_CATEGORY_LABELS } from "@/lib/crm/labels";

import { CrmAccountPicker, crmInputClass, crmLabelClass } from "../common";
import { CRM_MAX_UPLOAD_BYTES, useCrmErrorText } from "./shared";

const ACCEPT = "application/pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,.csv,.zip,.eml,.msg";

export function UploadDocumentDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
  const errorText = useCrmErrorText();
  const titleId = useId();
  const upload = useUploadDocument();
  const [account, setAccount] = useState<PickerOption | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("other");
  const [description, setDescription] = useState("");
  const [received, setReceived] = useState(false);
  const [tooBig, setTooBig] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!account || !file || tooBig) return;
    upload.mutate(
      { file, account: account.id, name: name.trim(), category, description, received },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog
      open
      titleId={titleId}
      title={t("crm.documents.upload.title")}
      onClose={onClose}
      pending={upload.isPending}
      widthClassName="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <CrmAccountPicker
          id="crm-doc-account"
          label={t("crm.documents.upload.account")}
          value={account}
          onChange={setAccount}
        />
        <div>
          <label htmlFor="crm-doc-file" className={crmLabelClass}>
            {t("crm.documents.upload.file")}
          </label>
          <input
            id="crm-doc-file"
            type="file"
            accept={ACCEPT}
            onChange={(e) => {
              const chosen = e.target.files?.[0] ?? null;
              setFile(chosen);
              setTooBig(!!chosen && chosen.size > CRM_MAX_UPLOAD_BYTES);
            }}
            className="text-sm"
          />
          <p className="mt-1 text-xs text-text-secondary">{t("crm.documents.maxSize")}</p>
          {tooBig ? (
            <p role="alert" className="mt-1 text-sm text-error">
              {t("crm.documents.tooBig")}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="crm-doc-name" className={crmLabelClass}>
              {t("crm.documents.upload.name")}
            </label>
            <input id="crm-doc-name" value={name} onChange={(e) => setName(e.target.value)} className={crmInputClass} />
          </div>
          <div>
            <label htmlFor="crm-doc-category" className={crmLabelClass}>
              {t("crm.documents.upload.category")}
            </label>
            <select
              id="crm-doc-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={crmInputClass}
            >
              {CRM_DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(CRM_DOCUMENT_CATEGORY_LABELS[c])}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="crm-doc-description" className={crmLabelClass}>
            {t("crm.documents.upload.description")}
          </label>
          <textarea
            id="crm-doc-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={crmInputClass}
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={received} onChange={(e) => setReceived(e.target.checked)} />
          {t("crm.documents.upload.received")}
        </label>
        {upload.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorText(upload.error)}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={upload.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={!account || !file || tooBig || upload.isPending}>
            {upload.isPending ? t("crm.documents.upload.uploading") : t("crm.documents.upload.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function NewVersionDialog({ document, onClose }: { document: CrmDocument; onClose: () => void }) {
  const t = useTranslations();
  const errorText = useCrmErrorText();
  const titleId = useId();
  const add = useAddDocumentVersion();
  const [file, setFile] = useState<File | null>(null);
  const [tooBig, setTooBig] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || tooBig) return;
    add.mutate({ id: document.id, file }, { onSuccess: onClose });
  }

  return (
    <Dialog
      open
      titleId={titleId}
      title={t("crm.documents.newVersion.title", { name: document.name })}
      onClose={onClose}
      pending={add.isPending}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-sm text-text-secondary">{t("crm.documents.newVersion.hint")}</p>
        <div>
          <label htmlFor="crm-doc-version-file" className={crmLabelClass}>
            {t("crm.documents.newVersion.file")}
          </label>
          <input
            id="crm-doc-version-file"
            type="file"
            accept={ACCEPT}
            onChange={(e) => {
              const chosen = e.target.files?.[0] ?? null;
              setFile(chosen);
              setTooBig(!!chosen && chosen.size > CRM_MAX_UPLOAD_BYTES);
            }}
            className="text-sm"
          />
          <p className="mt-1 text-xs text-text-secondary">{t("crm.documents.maxSize")}</p>
          {tooBig ? (
            <p role="alert" className="mt-1 text-sm text-error">
              {t("crm.documents.tooBig")}
            </p>
          ) : null}
        </div>
        {add.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorText(add.error)}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={add.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={!file || tooBig || add.isPending}>
            {add.isPending ? t("crm.documents.upload.uploading") : t("crm.documents.newVersion.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function VersionsDialog({
  document,
  onDownload,
  onClose,
}: {
  document: CrmDocument;
  onDownload: (versionId: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  const titleId = useId();
  const versions = [...document.versions].sort((a, b) => b.version - a.version);
  return (
    <Dialog open titleId={titleId} title={t("crm.documents.versions.title", { name: document.name })} onClose={onClose}>
      <p className="mb-2 text-sm text-text-secondary">{t("crm.documents.versions.note")}</p>
      <ul className="flex flex-col gap-2">
        {versions.map((v: CrmDocumentVersion) => (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
            <span>
              <span className="font-semibold">{t("crm.documents.version", { n: v.version })}</span>
              {" · "}
              {v.filename}
              <span className="block text-xs text-text-secondary">
                {t("crm.documents.versions.meta", {
                  date: formatDateTime(v.created_at),
                  by: v.uploaded_by_name || t("crm.common.none"),
                  size: Math.max(1, Math.round((v.size ?? 0) / 1024)),
                })}
              </span>
            </span>
            <Button type="button" variant="secondary" onClick={() => onDownload(v.id)}>
              {t("crm.documents.versions.download", { n: v.version })}
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-end">
        <Button type="button" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    </Dialog>
  );
}
