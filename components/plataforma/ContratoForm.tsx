"use client";

/**
 * Alta/edición de un contrato (`docs/PANEL.md` §13.1): al crear, elige
 * entidad y tramo (no se pueden cambiar después: `update_contract` solo
 * admite fechas y notas, `organization`/`tier`/`status` quedan fijos);
 * al editar, `organization`/`tier` se muestran de solo lectura. Mismo
 * patrón `editing: Contract | "new"` que `ProgramaForm.tsx`.
 *
 * **Límite conocido**: el selector de entidad usa `useOrganizations()`
 * sin filtro, solo la primera página (`ORGANIZATIONS.LIST` es paginada,
 * `docs/SEGURIDAD_Y_MODERACION.md` §8) — suficiente para el volumen de
 * entidades de esta fase; paginar el propio selector queda para quien
 * amplíe esta pantalla si hiciera falta.
 */
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { useCreateContract, useTiers, useUpdateContract, type BillingErrorKind } from "@/hooks/useBilling";
import { useOrganizations } from "@/hooks/useOrganizations";
import type { Contract } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

export interface ContratoFormProps {
  editing: Contract | "new";
  onDone: () => void;
}

/** Mismo criterio de validación de fechas que `lib/programs/validation.ts`: solo `fin >= inicio`. */
function hasInvalidContractDates(startsOn: string, endsOn: string): boolean {
  if (!startsOn || !endsOn) return false;
  return endsOn < startsOn;
}

// `createContract`/`updateContract` comparten `BillingError`, pero su
// fallback «desconocido» difiere en el texto real del hook («crear» vs.
// «guardar») — dos mapas casi idénticos, mismo patrón que
// `ProgramMutationError` en `ProgramaForm.tsx`.
const CREATE_CONTRACT_ERROR_KEYS: Record<BillingErrorKind, string> = {
  sin_acceso: "errors.contractMutation.sinAcceso",
  invalido: "errors.contractMutation.invalido",
  conflicto: "errors.contractMutation.conflicto",
  no_encontrado: "errors.contractMutation.noEncontrado",
  desconocido: "errors.contractMutation.desconocidoCrear",
};

const UPDATE_CONTRACT_ERROR_KEYS: Record<BillingErrorKind, string> = {
  ...CREATE_CONTRACT_ERROR_KEYS,
  desconocido: "errors.contractMutation.desconocidoGuardar",
};

export function ContratoForm({ editing, onDone }: ContratoFormProps) {
  const t = useTranslations();
  const organizations = useOrganizations();
  const tiers = useTiers();
  const createContract = useCreateContract();
  const updateContract = useUpdateContract();

  const [organization, setOrganization] = useState(
    editing === "new" ? "" : String(editing.organization.id),
  );
  const [tier, setTier] = useState(editing === "new" ? "" : String(editing.tier.id));
  const [startsOn, setStartsOn] = useState(editing === "new" ? "" : editing.starts_on);
  const [endsOn, setEndsOn] = useState(editing === "new" ? "" : editing.ends_on);
  const [notes, setNotes] = useState(editing === "new" ? "" : editing.notes);

  const mutation = editing === "new" ? createContract : updateContract;
  const mutationErrorKeys = editing === "new" ? CREATE_CONTRACT_ERROR_KEYS : UPDATE_CONTRACT_ERROR_KEYS;
  const mutationFallbackKey =
    editing === "new" ? "errors.contractMutation.desconocidoCrear" : "errors.contractMutation.desconocidoGuardar";
  const dateError = hasInvalidContractDates(startsOn, endsOn);
  const canSubmit =
    (editing !== "new" || (organization.length > 0 && tier.length > 0)) &&
    startsOn.length > 0 &&
    endsOn.length > 0 &&
    !dateError;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    if (editing === "new") {
      createContract.mutate(
        {
          organization: Number(organization),
          tier: Number(tier),
          starts_on: startsOn,
          ends_on: endsOn,
          notes,
        },
        { onSuccess: onDone },
      );
    } else {
      updateContract.mutate(
        { contractId: editing.id, starts_on: startsOn, ends_on: endsOn, notes },
        { onSuccess: onDone },
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="contrato-organization" className="mb-1 block text-sm font-medium text-text-form">
          {t("metrics.groupBy.organization")}
        </label>
        {editing === "new" ? (
          <select
            id="contrato-organization"
            value={organization}
            onChange={(event) => setOrganization(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          >
            <option value="">{t("plataforma.contratos.chooseOrganization")}</option>
            {organizations.data?.results.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        ) : (
          <p id="contrato-organization" className="text-sm text-text-base">
            {editing.organization.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="contrato-tier" className="mb-1 block text-sm font-medium text-text-form">
          {t("plataforma.contratos.tierLabel")}
        </label>
        {editing === "new" ? (
          <select
            id="contrato-tier"
            value={tier}
            onChange={(event) => setTier(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          >
            <option value="">{t("plataforma.contratos.chooseTier")}</option>
            {tiers.data?.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        ) : (
          <p id="contrato-tier" className="text-sm text-text-base">
            {editing.tier.name}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <label htmlFor="contrato-starts-on" className="mb-1 block text-sm font-medium text-text-form">
            {t("plataforma.contratos.startsOnLabel")}
          </label>
          <input
            id="contrato-starts-on"
            type="date"
            value={startsOn}
            onChange={(event) => setStartsOn(event.target.value)}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="contrato-ends-on" className="mb-1 block text-sm font-medium text-text-form">
            {t("plataforma.contratos.endsOnLabel")}
          </label>
          <input
            id="contrato-ends-on"
            type="date"
            value={endsOn}
            onChange={(event) => setEndsOn(event.target.value)}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>
      </div>

      <div>
        <label htmlFor="contrato-notes" className="mb-1 block text-sm font-medium text-text-form">
          {t("plataforma.contratos.notesLabel")}
        </label>
        <textarea
          id="contrato-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        />
      </div>

      {dateError ? (
        <p role="alert" className="text-sm text-error">
          {t("plataforma.contratos.endsBeforeStartsError")}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={!canSubmit || mutation.isPending}>
          {t("common.save")}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          {t("common.cancel")}
        </Button>
      </div>
      {mutation.isError ? (
        <p role="alert" className="text-sm text-error">
          {errorKindText(mutation.error, mutationErrorKeys, t, mutationFallbackKey)}
        </p>
      ) : null}
    </form>
  );
}
