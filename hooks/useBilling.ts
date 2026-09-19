"use client";

/**
 * Contratación pública y facturación (`docs/PANEL.md` §13, tarea B4
 * backend / W4 panel): tramos de precio, contratos y facturas, área
 * exclusiva de plataforma. Lectura para `superadmin`/`support`
 * (`HasPlatformRole`); escritura (crear/editar/activar/finalizar/pagar)
 * solo `superadmin` — un `support` que escribe recibe 403 con
 * `{"detail": "Esta acción es solo para superadmin de plataforma."}`
 * (mismo formato en las ocho rutas, `docs/PANEL.md` §13.2/§13.3),
 * traducido aquí igual que `useProgramMutations.ts` (`detailOf`).
 * Invariante 7: un contrato `ended` no limita nada de la entidad — este
 * módulo solo lee/escribe `billing`, nunca condiciona otro permiso.
 *
 * Un solo fichero para lectura y escritura (a diferencia de
 * `usePrograms`/`useProgram`/`useProgramMutations`, repartidos en tres):
 * el brief de esta tarea (`hooks/useBilling.ts`) lo pide así, y el
 * módulo es más pequeño (cuatro recursos de solo lectura + ocho
 * mutaciones) que Programas.
 */
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { BILLING } from "@/lib/api/endpoints";
import type {
  BillingSummary,
  Contract,
  ContractCreateRequest,
  ContractStatus,
  ContractUpdateRequest,
  Invoice,
  InvoiceCreateRequest,
  PricingTier,
  PricingTierCreateRequest,
  PricingTierUpdateRequest,
} from "@/lib/api/types";

export type BillingErrorKind = "sin_acceso" | "invalido" | "conflicto" | "no_encontrado" | "desconocido";

export class BillingError extends Error {
  readonly kind: BillingErrorKind;
  /**
   * Texto verbatim del backend, solo cuando `detailOf` encuentra algo
   * (tarea 5 de i18n, mismo patrón que el resto de errores tipados del
   * panel): `ContratosPanel.tsx`/`ContratoForm.tsx`/`FacturaForm.tsx`
   * traducen con `errorKindText`, que le da prioridad sobre la
   * traducción fija por `kind`.
   */
  readonly detail?: string;

  constructor(kind: BillingErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "BillingError";
    this.kind = kind;
    this.detail = detail;
  }
}

/**
 * `PricingTierInputRequest`/`ContractInputRequest`/`InvoiceInputRequest`
 * (DRF estándar) devuelven sus errores de campo como `{campo:
 * ["mensaje"]}`; los 409 de transición (`activate`/`end`) y los 403 de
 * «solo superadmin» llevan `{detail: "..."}` (`billing/viewsets.py`).
 * Las dos formas las lee `lib/api/drfError.ts::detailOf`, compartido con
 * el resto del panel.
 */
function toBillingError(error: unknown, fallback: string): BillingError {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      const detail = detailOf(error);
      return new BillingError(
        "sin_acceso",
        detail ?? "Esta acción es solo para superadmin de plataforma.",
        detail,
      );
    }
    if (error.status === 400) {
      const detail = detailOf(error);
      return new BillingError("invalido", detail ?? "Revisa los datos: alguno no es válido.", detail);
    }
    if (error.status === 404) {
      return new BillingError("no_encontrado", "Este recurso no existe.");
    }
    if (error.status === 409) {
      const detail = detailOf(error);
      return new BillingError(
        "conflicto",
        detail ?? "Esta acción no es válida en el estado actual.",
        detail,
      );
    }
  }
  return new BillingError("desconocido", fallback);
}

const SUMMARY_KEY = ["billing-summary"];
const TIERS_KEY = ["billing-tiers"];
const CONTRACTS_KEY = "billing-contracts";
const INVOICES_KEY = "billing-invoices";

function invalidateAfterContractChange(
  queryClient: ReturnType<typeof useQueryClient>,
  contractId?: number | string,
): void {
  queryClient.invalidateQueries({ queryKey: [CONTRACTS_KEY] });
  queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
  if (contractId !== undefined) {
    queryClient.invalidateQueries({ queryKey: [INVOICES_KEY, contractId] });
  }
}

/* ---------------------------------------------------------------------- */
/* Lectura                                                                 */
/* ---------------------------------------------------------------------- */

/** `GET .../summary/`: portada de plataforma (contratos vigentes, valor anual, facturas vencidas). */
export function useBillingSummary(): UseQueryResult<BillingSummary, BillingError> {
  return useQuery<BillingSummary, BillingError>({
    queryKey: SUMMARY_KEY,
    queryFn: async () => {
      try {
        return await apiFetch<BillingSummary>(BILLING.SUMMARY());
      } catch (error) {
        throw toBillingError(error, "No se pudo cargar el resumen de facturación.");
      }
    },
  });
}

/** `GET .../tiers/`: tramos de precio, array plano. */
export function useTiers(): UseQueryResult<PricingTier[], BillingError> {
  return useQuery<PricingTier[], BillingError>({
    queryKey: TIERS_KEY,
    queryFn: async () => {
      try {
        return await apiFetch<PricingTier[]>(BILLING.TIERS());
      } catch (error) {
        throw toBillingError(error, "No se pudieron cargar los tramos.");
      }
    },
  });
}

export interface ContractsFilters {
  organization?: number | string;
  status?: ContractStatus;
}

function buildContractsQuery(filters: ContractsFilters): string {
  const params = new URLSearchParams();
  if (filters.organization !== undefined) params.set("organization", String(filters.organization));
  if (filters.status) params.set("status", filters.status);
  return params.toString();
}

/** `GET .../contracts/?organization=&status=`: array plano. */
export function useContracts(filters: ContractsFilters = {}): UseQueryResult<Contract[], BillingError> {
  const query = buildContractsQuery(filters);

  return useQuery<Contract[], BillingError>({
    queryKey: [CONTRACTS_KEY, query],
    queryFn: async () => {
      try {
        return await apiFetch<Contract[]>(`${BILLING.CONTRACTS()}${query ? `?${query}` : ""}`);
      } catch (error) {
        throw toBillingError(error, "No se pudieron cargar los contratos.");
      }
    },
  });
}

/**
 * `GET .../contracts/{id}/invoices/`: array plano. Deshabilitado sin
 * `contractId` (p. ej. la pestaña «Facturas» antes de elegir contrato).
 */
export function useInvoices(
  contractId: number | string | undefined,
): UseQueryResult<Invoice[], BillingError> {
  return useQuery<Invoice[], BillingError>({
    queryKey: [INVOICES_KEY, contractId],
    queryFn: async () => {
      try {
        return await apiFetch<Invoice[]>(BILLING.CONTRACT_INVOICES(contractId as number | string));
      } catch (error) {
        throw toBillingError(error, "No se pudieron cargar las facturas.");
      }
    },
    enabled: contractId !== undefined && contractId !== "",
  });
}

/* ---------------------------------------------------------------------- */
/* Tramos (solo superadmin)                                                */
/* ---------------------------------------------------------------------- */

/** `POST .../tiers/`. */
export function useCreateTier(): UseMutationResult<PricingTier, BillingError, PricingTierCreateRequest> {
  const queryClient = useQueryClient();

  return useMutation<PricingTier, BillingError, PricingTierCreateRequest>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<PricingTier>(BILLING.TIERS(), { method: "POST", body: input });
      } catch (error) {
        throw toBillingError(error, "No se pudo crear el tramo.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIERS_KEY });
      queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
    },
  });
}

export interface UpdateTierInput extends PricingTierUpdateRequest {
  tierId: number | string;
}

/** `PATCH .../tiers/{id}/`. */
export function useUpdateTier(): UseMutationResult<PricingTier, BillingError, UpdateTierInput> {
  const queryClient = useQueryClient();

  return useMutation<PricingTier, BillingError, UpdateTierInput>({
    mutationFn: async ({ tierId, ...fields }) => {
      try {
        return await apiFetch<PricingTier>(BILLING.TIER(tierId), { method: "PATCH", body: fields });
      } catch (error) {
        throw toBillingError(error, "No se pudo guardar el tramo.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIERS_KEY });
      queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
      queryClient.invalidateQueries({ queryKey: [CONTRACTS_KEY] });
    },
  });
}

/* ---------------------------------------------------------------------- */
/* Contratos (solo superadmin)                                             */
/* ---------------------------------------------------------------------- */

/** `POST .../contracts/`: nace en `draft`. */
export function useCreateContract(): UseMutationResult<Contract, BillingError, ContractCreateRequest> {
  const queryClient = useQueryClient();

  return useMutation<Contract, BillingError, ContractCreateRequest>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<Contract>(BILLING.CONTRACTS(), { method: "POST", body: input });
      } catch (error) {
        throw toBillingError(error, "No se pudo crear el contrato.");
      }
    },
    onSuccess: () => invalidateAfterContractChange(queryClient),
  });
}

export interface UpdateContractInput extends ContractUpdateRequest {
  contractId: number | string;
}

/** `PATCH .../contracts/{id}/`: solo fechas y notas, `draft`/`active` (409 si `ended`). */
export function useUpdateContract(): UseMutationResult<Contract, BillingError, UpdateContractInput> {
  const queryClient = useQueryClient();

  return useMutation<Contract, BillingError, UpdateContractInput>({
    mutationFn: async ({ contractId, ...fields }) => {
      try {
        return await apiFetch<Contract>(BILLING.CONTRACT(contractId), { method: "PATCH", body: fields });
      } catch (error) {
        throw toBillingError(error, "No se pudo guardar el contrato.");
      }
    },
    onSuccess: (_data, variables) => invalidateAfterContractChange(queryClient, variables.contractId),
  });
}

/** `POST .../contracts/{id}/activate/`: `draft -> active`, sin cuerpo. */
export function useActivateContract(): UseMutationResult<Contract, BillingError, number | string> {
  const queryClient = useQueryClient();

  return useMutation<Contract, BillingError, number | string>({
    mutationFn: async (contractId) => {
      try {
        return await apiFetch<Contract>(BILLING.CONTRACT_ACTIVATE(contractId), { method: "POST" });
      } catch (error) {
        throw toBillingError(error, "No se pudo activar el contrato.");
      }
    },
    onSuccess: (_data, contractId) => invalidateAfterContractChange(queryClient, contractId),
  });
}

/** `POST .../contracts/{id}/end/`: `active -> ended`, sin cuerpo. */
export function useEndContract(): UseMutationResult<Contract, BillingError, number | string> {
  const queryClient = useQueryClient();

  return useMutation<Contract, BillingError, number | string>({
    mutationFn: async (contractId) => {
      try {
        return await apiFetch<Contract>(BILLING.CONTRACT_END(contractId), { method: "POST" });
      } catch (error) {
        throw toBillingError(error, "No se pudo finalizar el contrato.");
      }
    },
    onSuccess: (_data, contractId) => invalidateAfterContractChange(queryClient, contractId),
  });
}

/* ---------------------------------------------------------------------- */
/* Facturas (solo superadmin)                                              */
/* ---------------------------------------------------------------------- */

export interface CreateInvoiceInput extends InvoiceCreateRequest {
  contractId: number | string;
}

/** `POST .../contracts/{id}/invoices/`: `number` único (400 si se repite). */
export function useCreateInvoice(): UseMutationResult<Invoice, BillingError, CreateInvoiceInput> {
  const queryClient = useQueryClient();

  return useMutation<Invoice, BillingError, CreateInvoiceInput>({
    mutationFn: async ({ contractId, ...fields }) => {
      try {
        return await apiFetch<Invoice>(BILLING.CONTRACT_INVOICES(contractId), {
          method: "POST",
          body: fields,
        });
      } catch (error) {
        throw toBillingError(error, "No se pudo crear la factura.");
      }
    },
    onSuccess: (_data, variables) => invalidateAfterContractChange(queryClient, variables.contractId),
  });
}

export interface PayInvoiceInput {
  invoiceId: number | string;
  /** Necesario solo para invalidar la lista de facturas del contrato al que pertenece. */
  contractId: number | string;
  paidOn: string;
}

/** `POST /api/plataforma/billing/invoices/{id}/pay/ {paid_on}`. */
export function usePayInvoice(): UseMutationResult<Invoice, BillingError, PayInvoiceInput> {
  const queryClient = useQueryClient();

  return useMutation<Invoice, BillingError, PayInvoiceInput>({
    mutationFn: async ({ invoiceId, paidOn }) => {
      try {
        return await apiFetch<Invoice>(BILLING.INVOICE_PAY(invoiceId), {
          method: "POST",
          body: { paid_on: paidOn },
        });
      } catch (error) {
        throw toBillingError(error, "No se pudo marcar la factura como pagada.");
      }
    },
    onSuccess: (_data, variables) => invalidateAfterContractChange(queryClient, variables.contractId),
  });
}
