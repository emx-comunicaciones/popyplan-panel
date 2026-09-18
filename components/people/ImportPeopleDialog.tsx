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

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useImportPeople } from "@/hooks/useImportPeople";
import type { ImportPeopleResult } from "@/lib/api/types";
import { validateImportFile } from "@/lib/people/validateImportFile";

export interface ImportPeopleDialogProps {
  orgId: number | string;
  onClose: () => void;
}

type Phase = "select" | "preview" | "done";

function ResultSummary({ result }: { result: ImportPeopleResult }) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-4 text-sm text-text-base">
        <li>
          Creadas: <strong>{result.created}</strong>
        </li>
        <li>
          Reenviadas: <strong>{result.resent}</strong>
        </li>
        <li>
          Ya eran miembros: <strong>{result.already_members}</strong>
        </li>
        <li>
          Errores: <strong>{result.errors.length}</strong>
        </li>
      </ul>
      {result.errors.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Errores por fila</caption>
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th scope="col" className="px-2 py-1 font-semibold">
                  Fila
                </th>
                <th scope="col" className="px-2 py-1 font-semibold">
                  Email
                </th>
                <th scope="col" className="px-2 py-1 font-semibold">
                  Motivo
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

  const [phase, setPhase] = useState<Phase>("select");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
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
      title="Importar personas"
      pending={importPeople.isPending}
      onClose={handleClose}
    >
      <div className="flex flex-col gap-4">
        <a
          href="/plantilla-personas.csv"
          download
          className="text-sm text-primary-700 underline underline-offset-2"
        >
          Descargar plantilla
        </a>

        {phase === "select" ? (
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor="import-people-file" className="mb-1 block text-sm font-medium text-text-form">
                Fichero (.xlsx o .csv)
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
                  {fileError}
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={handlePreview} disabled={!file || importPeople.isPending}>
                Vista previa
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={importPeople.isPending}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "preview" && preview ? (
          <div className="flex flex-col gap-3">
            <ResultSummary result={preview} />
            {preview.errors.length > 0 ? (
              <p className="text-sm text-text-secondary">
                Las filas con error no se importarán; el resto de filas válidas se puede
                confirmar igual.
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="button" onClick={handleConfirm} disabled={importPeople.isPending}>
                Confirmar importación
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
                Elegir otro fichero
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={importPeople.isPending}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "done" && finalResult ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-success">Importación confirmada.</p>
            <ResultSummary result={finalResult} />
            <div>
              <Button type="button" onClick={handleClose}>
                Cerrar
              </Button>
            </div>
          </div>
        ) : null}

        {importPeople.isError ? (
          <p role="alert" className="text-sm text-error">
            {importPeople.error.message}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
