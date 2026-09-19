"use client";

/**
 * «Importar Excel/CSV» (tarea W3b, `docs/PANEL.md` §3b.3): sube un
 * `.csv`/`.xlsx`, primero con `dry_run=true` (vista previa sin escribir
 * nada) y solo si la persona confirma, `dry_run=false` (import real).
 * Límite de tamaño en el cliente (`lib/people/validateImportFile.ts`,
 * 5 MB) antes de intentar la subida, igual que
 * `components/entidad/RecursosPanel.tsx` con los recursos — el backend
 * valida otra vez de todos modos (2000 filas máximo, §3b.3). Errores por
 * fila (`{row, email, error}`) no bloquean confirmar: las filas válidas
 * (`created`/`resent`/`already_members`) se importan igual, el aviso lo
 * dice explícitamente en la vista previa.
 */
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useImportPeople } from "@/hooks/useImportPeople";
import type { ImportPeopleResult } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { IMPORT_MAX_MB, validateImportFile, type ImportFileErrorKind } from "@/lib/people/validateImportFile";

export interface ImportPeopleDialogProps {
  orgId: number | string;
  onClose: () => void;
}

type Phase = "select" | "preview" | "done";

const IMPORT_PEOPLE_ERROR_KEYS = {
  invalido: "errors.importPeople.invalido",
  sin_permiso: "errors.importPeople.sinPermiso",
  desconocido: "errors.importPeople.desconocido",
} as const;

const IMPORT_FILE_ERROR_KEYS: Record<ImportFileErrorKind, string> = {
  tipo_no_permitido: "people.importDialog.errors.tipoNoPermitido",
  demasiado_grande: "people.importDialog.errors.demasiadoGrande",
};

function ResultSummary({ result }: { result: ImportPeopleResult }) {
  const t = useTranslations("people.importDialog");

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-4 text-sm text-text-base">
        <li>
          {t("summaryCreated")} <strong>{result.created}</strong>
        </li>
        <li>
          {t("summaryResent")} <strong>{result.resent}</strong>
        </li>
        <li>
          {t("summaryAlreadyMembers")} <strong>{result.already_members}</strong>
        </li>
        <li>
          {t("summaryErrors")} <strong>{result.errors.length}</strong>
        </li>
      </ul>
      {result.errors.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("errorsTableCaption")}</caption>
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th scope="col" className="px-2 py-1 font-semibold">
                  {t("colRow")}
                </th>
                <th scope="col" className="px-2 py-1 font-semibold">
                  {t("colEmail")}
                </th>
                <th scope="col" className="px-2 py-1 font-semibold">
                  {t("colReason")}
                </th>
              </tr>
            </thead>
            <tbody>
              {result.errors.map((rowError) => (
                <tr key={rowError.row} className="border-b border-border-light">
                  <td className="px-2 py-1">{rowError.row}</td>
                  <td className="px-2 py-1">{rowError.email}</td>
                  <td className="px-2 py-1">{rowError.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export function ImportPeopleDialog({ orgId, onClose }: ImportPeopleDialogProps) {
  const importPeople = useImportPeople(orgId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("people.importDialog");
  const tAll = useTranslations();

  const [phase, setPhase] = useState<Phase>("select");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<ImportFileErrorKind | null>(null);
  const [preview, setPreview] = useState<ImportPeopleResult | null>(null);
  const [finalResult, setFinalResult] = useState<ImportPeopleResult | null>(null);

  function resetAll() {
    setPhase("select");
    setFile(null);
    setFileError(null);
    setPreview(null);
    setFinalResult(null);
    importPeople.reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    if (importPeople.isPending) return;
    resetAll();
    onClose();
  }

  function handleFileChange(fileList: FileList | null) {
    const chosen = fileList?.[0] ?? null;
    if (!chosen) {
      setFile(null);
      setFileError(null);
      return;
    }
    const error = validateImportFile(chosen);
    setFileError(error);
    setFile(error ? null : chosen);
  }

  function handlePreview() {
    if (!file) return;
    importPeople.mutate(
      { file, dryRun: true },
      {
        onSuccess: (result) => {
          setPreview(result);
          setPhase("preview");
        },
      },
    );
  }

  function handleConfirm() {
    if (!file) return;
    importPeople.mutate(
      { file, dryRun: false },
      {
        onSuccess: (result) => {
          setFinalResult(result);
          setPhase("done");
        },
      },
    );
  }

  return (
    <Dialog
      open
      titleId="import-people-title"
      title={t("title")}
      pending={importPeople.isPending}
      onClose={handleClose}
    >
      <div className="flex flex-col gap-4">
        <a
          href="/plantilla-personas.csv"
          download
          className="text-sm text-primary-700 underline underline-offset-2"
        >
          {t("downloadTemplate")}
        </a>

        {phase === "select" ? (
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="import-people-file" className="mb-1 block text-sm font-medium text-text-form">
                {t("fileLabel")}
              </label>
              <input
                id="import-people-file"
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={(event) => handleFileChange(event.target.files)}
                className="block text-sm"
              />
              {fileError ? (
                <p role="alert" className="mt-1 text-xs text-error">
                  {fileError === "demasiado_grande"
                    ? tAll(IMPORT_FILE_ERROR_KEYS[fileError], { max: IMPORT_MAX_MB })
                    : tAll(IMPORT_FILE_ERROR_KEYS[fileError])}
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={handlePreview} disabled={!file || importPeople.isPending}>
                {t("preview")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={importPeople.isPending}
              >
                {tAll("common.cancel")}
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "preview" && preview ? (
          <div className="flex flex-col gap-3">
            <ResultSummary result={preview} />
            {preview.errors.length > 0 ? (
              <p className="text-sm text-text-secondary">{t("errorsNotBlocking")}</p>
            ) : null}
            <div className="flex gap-2">
              <Button type="button" onClick={handleConfirm} disabled={importPeople.isPending}>
                {t("confirm")}
              </Button>
              {/* Volver a la selección olvida el fichero y la vista previa:
                  dejarlos puestos hacía que «Vista previa» reenviara el
                  mismo fichero como si fuera otro. */}
              <Button
                type="button"
                variant="secondary"
                onClick={resetAll}
                disabled={importPeople.isPending}
              >
                {t("chooseAnotherFile")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={importPeople.isPending}
              >
                {tAll("common.cancel")}
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "done" && finalResult ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-success">{t("confirmed")}</p>
            <ResultSummary result={finalResult} />
            <div>
              <Button type="button" onClick={handleClose}>
                {tAll("common.close")}
              </Button>
            </div>
          </div>
        ) : null}

        {importPeople.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(
              importPeople.error,
              IMPORT_PEOPLE_ERROR_KEYS,
              tAll,
              "errors.importPeople.desconocido",
            )}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
