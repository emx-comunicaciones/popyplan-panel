"use client";

/**
 * Contratos y facturación (`docs/PANEL.md` §13, tarea B4 backend / W4
 * panel): tres pestañas — Contratos, Tramos, Facturas — con el mismo
 * selector de botones que `EntidadDetail.tsx` (sin ARIA tabs, el panel
 * no tenía ese patrón todavía). Lectura para `superadmin`/`support`;
 * `canManage` (`role === "superadmin"`) decide qué botones de escritura
 * se pintan — **ocultos, no deshabilitados**, para `support` (brief de
 * esta tarea): un `support` nunca ve «Nuevo contrato», «Activar»,
 * «Finalizar», «Editar», «Nuevo tramo» ni «Marcar pagada», aunque el
 * backend ya se lo impediría con un 403 si los viera.
 *
 * Invariante 7 (nada de seguridad detrás de pago): un contrato `ended`
 * no limita ninguna función de la entidad — este panel es solo la vista
 * de plataforma sobre `billing`, nunca condiciona el resto del panel.
 * Un contrato ya finalizado tampoco ofrece «Editar»: el backend rechaza
 * cualquier cambio sobre él.
 *
 * Las dos acciones que pasan por `ConfirmDialog` («Finalizar» y «Marcar
 * pagada») pintan el error de su mutación **dentro** del diálogo, que
 * solo se cierra si la llamada sale bien — mismo patrón que «Quitar» del
 * equipo o «Revocar» una invitación.
 */
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import {
  useActivateContract,
  useContracts,
  useCreateTier,
  useEndContract,
  useInvoices,
  usePayInvoice,
  useTiers,
  useUpdateTier,
  type BillingErrorKind,
  type ContractsFilters,
} from "@/hooks/useBilling";
import { useOrganizations } from "@/hooks/useOrganizations";
import type { Contract, ContractStatus, Invoice, InvoiceStatus, PricingTier } from "@/lib/api/types";
import { tierRangeFromFields, validateTierRange } from "@/lib/billing/tierRange";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { localeForUseLocale } from "@/lib/i18n/locale";
import { eurosToCents, formatEuros } from "@/lib/programs/money";

import { ContratoForm } from "./ContratoForm";
import { FacturaForm } from "./FacturaForm";

export interface ContratosPanelProps {
  role: string | null;
}

const SECTIONS = ["contratos", "tramos", "facturas"] as const;
type Section = (typeof SECTIONS)[number];
const SECTION_LABEL_KEYS: Record<Section, string> = {
  contratos: "plataforma.contratos.tabContratos",
  tramos: "plataforma.contratos.tabTramos",
  facturas: "plataforma.contratos.tabFacturas",
};

const CONTRACT_STATUS_LABEL_KEYS: Record<ContractStatus, string> = {
  draft: "plataforma.contratos.statusDraft",
  active: "plataforma.contratos.statusActive",
  ended: "plataforma.contratos.statusEnded",
};
const CONTRACT_STATUS_TONES: Record<ContractStatus, BadgeTone> = {
  draft: "neutral",
  active: "success",
  ended: "info",
};

const INVOICE_STATUS_LABEL_KEYS: Record<InvoiceStatus, string> = {
  paid: "plataforma.contratos.invoiceStatusPaid",
  pending: "plataforma.contratos.invoiceStatusPending",
  overdue: "plataforma.contratos.invoiceStatusOverdue",
};
const INVOICE_STATUS_TONES: Record<InvoiceStatus, BadgeTone> = {
  paid: "success",
  pending: "neutral",
  overdue: "error",
};

// Las tres mutaciones de contrato (activar/finalizar) y de tramo
// (crear/guardar) comparten `BillingError` — mismo patrón que
// `ContratoForm.tsx`: `sin_acceso`/`invalido`/`conflicto`/`no_encontrado`
// son idénticos en las cuatro (`toBillingError` los fija igual para toda
// `billing`), solo `desconocido` cambia por acción.
const BILLING_SHARED_ERROR_KEYS = {
  sin_acceso: "errors.contractMutation.sinAcceso",
  invalido: "errors.contractMutation.invalido",
  conflicto: "errors.contractMutation.conflicto",
  no_encontrado: "errors.contractMutation.noEncontrado",
} as const;

const ACTIVATE_CONTRACT_ERROR_KEYS: Record<BillingErrorKind, string> = {
  ...BILLING_SHARED_ERROR_KEYS,
  desconocido: "errors.contractMutation.desconocidoActivar",
};

const END_CONTRACT_ERROR_KEYS: Record<BillingErrorKind, string> = {
  ...BILLING_SHARED_ERROR_KEYS,
  desconocido: "errors.contractMutation.desconocidoFinalizar",
};

const CREATE_TIER_ERROR_KEYS: Record<BillingErrorKind, string> = {
  ...BILLING_SHARED_ERROR_KEYS,
  desconocido: "errors.tierMutation.desconocidoCrear",
};

const UPDATE_TIER_ERROR_KEYS: Record<BillingErrorKind, string> = {
  ...BILLING_SHARED_ERROR_KEYS,
  desconocido: "errors.tierMutation.desconocidoGuardar",
};

const PAY_INVOICE_ERROR_KEYS: Record<BillingErrorKind, string> = {
  ...BILLING_SHARED_ERROR_KEYS,
  desconocido: "errors.payInvoice.desconocido",
};

const CONTRACTS_QUERY_ERROR_KEYS: Record<BillingErrorKind, string> = {
  ...BILLING_SHARED_ERROR_KEYS,
  desconocido: "errors.contractsQuery.desconocido",
};

const TIERS_QUERY_ERROR_KEYS: Record<BillingErrorKind, string> = {
  ...BILLING_SHARED_ERROR_KEYS,
  desconocido: "errors.tiersQuery.desconocido",
};

const INVOICES_QUERY_ERROR_KEYS: Record<BillingErrorKind, string> = {
  ...BILLING_SHARED_ERROR_KEYS,
  desconocido: "errors.invoicesQuery.desconocido",
};

function invoiceStatus(invoice: Invoice): InvoiceStatus {
  return (invoice.status as InvoiceStatus) in INVOICE_STATUS_LABEL_KEYS
    ? (invoice.status as InvoiceStatus)
    : "pending";
}

function formatDate(iso: string, locale: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(localeForUseLocale(locale));
}

/* ---------------------------------------------------------------------- */
/* Contratos                                                               */
/* ---------------------------------------------------------------------- */

interface ContratosTabProps {
  canManage: boolean;
  onViewInvoices: (contractId: number | string) => void;
}

function ContratosTab({ canManage, onViewInvoices }: ContratosTabProps) {
  const t = useTranslations();
  const locale = useLocale();
  const organizations = useOrganizations();
  const [filters, setFilters] = useState<ContractsFilters>({});
  const contracts = useContracts(filters);
  const activate = useActivateContract();
  const endContract = useEndContract();
  const [editing, setEditing] = useState<Contract | "new" | null>(null);
  const [ending, setEnding] = useState<Contract | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="contratos-filter-org" className="mb-1 block text-sm font-medium text-text-form">
            {t("plataforma.contratos.orgFilterLabel")}
          </label>
          <select
            id="contratos-filter-org"
            value={filters.organization ?? ""}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                organization: event.target.value ? Number(event.target.value) : undefined,
              }))
            }
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          >
            <option value="">{t("plataforma.entidades.verifiedFilterAll")}</option>
            {organizations.data?.results.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="contratos-filter-status" className="mb-1 block text-sm font-medium text-text-form">
            {t("plataforma.reportes.statusLabel")}
          </label>
          <select
            id="contratos-filter-status"
            value={filters.status ?? ""}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                status: (event.target.value || undefined) as ContractStatus | undefined,
              }))
            }
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          >
            <option value="">{t("plataforma.reportes.statusAll")}</option>
            <option value="draft">{t("plataforma.contratos.statusDraft")}</option>
            <option value="active">{t("plataforma.contratos.statusActive")}</option>
            <option value="ended">{t("plataforma.contratos.statusEnded")}</option>
          </select>
        </div>
        {canManage ? (
          <Button type="button" onClick={() => setEditing("new")}>
            {t("plataforma.contratos.newContract")}
          </Button>
        ) : null}
      </div>

      {contracts.isError ? (
        <ErrorState
          title={t("plataforma.contratos.loadError")}
          description={errorKindText(contracts.error, CONTRACTS_QUERY_ERROR_KEYS, t, "errors.contractsQuery.desconocido")}
        />
      ) : !contracts.data ? (
        <p className="text-sm text-text-secondary">{t("plataforma.contratos.loading")}</p>
      ) : contracts.data.length === 0 ? (
        <EmptyState title={t("plataforma.contratos.emptyTitle")} />
      ) : (
        <Table<Contract>
          caption={t("plataforma.contratos.tableCaption")}
          getRowKey={(contract) => String(contract.id)}
          rows={contracts.data}
          columns={[
            { key: "org", header: t("plataforma.contratos.orgFilterLabel"), render: (c) => c.organization.name },
            { key: "tier", header: t("plataforma.contratos.tierLabel"), render: (c) => c.tier.name },
            {
              key: "vigencia",
              header: t("plataforma.contratos.validityHeader"),
              render: (c) => `${formatDate(c.starts_on, locale)} – ${formatDate(c.ends_on, locale)}`,
            },
            {
              key: "estado",
              header: t("plataforma.reportes.statusLabel"),
              render: (c) => (
                <Badge tone={CONTRACT_STATUS_TONES[c.status]}>{t(CONTRACT_STATUS_LABEL_KEYS[c.status])}</Badge>
              ),
            },
            {
              key: "facturas",
              header: t("plataforma.contratos.pendingAmountHeader"),
              render: (c) =>
                t("plataforma.contratos.pendingAmountValue", {
                  amountText: formatEuros(c.pending_amount_cents),
                  count: c.invoices_count,
                }),
            },
            {
              key: "acciones",
              header: t("common.actions"),
              render: (c) => (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => onViewInvoices(c.id)}>
                    {t("plataforma.contratos.viewInvoices")}
                  </Button>
                  {/* Un contrato finalizado no se modifica (el backend
                      responde 409 a cualquier cambio), así que no se
                      ofrece «Editar» sobre él. */}
                  {canManage && c.status !== "ended" ? (
                    <Button type="button" variant="secondary" onClick={() => setEditing(c)}>
                      {t("entidad.programaFicha.edit")}
                    </Button>
                  ) : null}
                  {canManage && c.status === "draft" ? (
                    <Button type="button" disabled={activate.isPending} onClick={() => activate.mutate(c.id)}>
                      {t("entidad.programaFicha.activate")}
                    </Button>
                  ) : null}
                  {canManage && c.status === "active" ? (
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => {
                        endContract.reset();
                        setEnding(c);
                      }}
                    >
                      {t("plataforma.contratos.endContractAction")}
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      )}
      {activate.isError ? (
        <p role="alert" className="text-sm text-error">
          {errorKindText(activate.error, ACTIVATE_CONTRACT_ERROR_KEYS, t, "errors.contractMutation.desconocidoActivar")}
        </p>
      ) : null}

      <Dialog
        open={editing !== null}
        titleId="contrato-dialog-title"
        title={editing === "new" ? t("plataforma.contratos.newContract") : t("plataforma.contratos.editContract")}
        onClose={() => setEditing(null)}
      >
        {editing !== null ? <ContratoForm editing={editing} onDone={() => setEditing(null)} /> : null}
      </Dialog>

      <ConfirmDialog
        open={ending !== null}
        title={t("plataforma.contratos.endContractConfirmTitle")}
        description={
          // Mismo patrón que «Quitar» del equipo o «Revocar» invitación:
          // el error se lee dentro del diálogo, que solo se cierra si la
          // llamada sale bien.
          <div className="flex flex-col gap-2">
            <p>{t("plataforma.contratos.endContractDescription")}</p>
            {endContract.isError ? (
              <p role="alert" className="text-error">
                {errorKindText(endContract.error, END_CONTRACT_ERROR_KEYS, t, "errors.contractMutation.desconocidoFinalizar")}
              </p>
            ) : null}
          </div>
        }
        confirmLabel={t("plataforma.contratos.endContractAction")}
        pending={endContract.isPending}
        onCancel={() => {
          endContract.reset();
          setEnding(null);
        }}
        onConfirm={() => {
          if (!ending) return;
          endContract.mutate(ending.id, { onSuccess: () => setEnding(null) });
        }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Tramos                                                                  */
/* ---------------------------------------------------------------------- */

interface TierFormProps {
  editing: PricingTier | "new";
  onDone: () => void;
}

function TierForm({ editing, onDone }: TierFormProps) {
  const t = useTranslations();
  const createTier = useCreateTier();
  const updateTier = useUpdateTier();
  const [name, setName] = useState(editing === "new" ? "" : editing.name);
  const [minPopulation, setMinPopulation] = useState(
    editing === "new" ? "0" : String(editing.min_population ?? 0),
  );
  const [maxPopulation, setMaxPopulation] = useState(
    editing === "new" || editing.max_population == null ? "" : String(editing.max_population),
  );
  const [priceEuros, setPriceEuros] = useState(
    editing === "new" ? "" : (editing.annual_price_cents / 100).toFixed(2),
  );
  const [isActive, setIsActive] = useState(editing === "new" ? true : (editing.is_active ?? true));

  const [rangeError, setRangeError] = useState<string | null>(null);

  const mutation = editing === "new" ? createTier : updateTier;
  const mutationErrorKeys = editing === "new" ? CREATE_TIER_ERROR_KEYS : UPDATE_TIER_ERROR_KEYS;
  const mutationFallbackKey =
    editing === "new" ? "errors.tierMutation.desconocidoCrear" : "errors.tierMutation.desconocidoGuardar";
  // Misma conversión que el presupuesto de Programas: redondear tras
  // multiplicar por 100 evita el error de coma flotante de JS.
  const priceCents = eurosToCents(priceEuros);
  const canSubmit = name.trim().length > 0 && priceEuros.trim().length > 0 && !Number.isNaN(priceCents);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    const range = tierRangeFromFields(minPopulation, maxPopulation);
    const invalidRange = validateTierRange(range);
    if (invalidRange) {
      setRangeError(invalidRange);
      return;
    }
    setRangeError(null);

    const fields = {
      name,
      min_population: range.min,
      max_population: range.max,
      annual_price_cents: priceCents,
      is_active: isActive,
    };

    if (editing === "new") {
      createTier.mutate(fields, { onSuccess: onDone });
    } else {
      updateTier.mutate({ tierId: editing.id, ...fields }, { onSuccess: onDone });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="tramo-name" className="mb-1 block text-sm font-medium text-text-form">
          {t("plataforma.contratos.tierNameLabel")}
        </label>
        <input
          id="tramo-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <div>
          <label htmlFor="tramo-min" className="mb-1 block text-sm font-medium text-text-form">
            {t("plataforma.contratos.minPopulationLabel")}
          </label>
          <input
            id="tramo-min"
            type="number"
            min="0"
            value={minPopulation}
            aria-describedby={rangeError ? "tramo-rango-error" : undefined}
            onChange={(event) => {
              setRangeError(null);
              setMinPopulation(event.target.value);
            }}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="tramo-max" className="mb-1 block text-sm font-medium text-text-form">
            {t("plataforma.contratos.maxPopulationLabel")}
          </label>
          <input
            id="tramo-max"
            type="number"
            min="0"
            value={maxPopulation}
            aria-describedby={rangeError ? "tramo-rango-error" : undefined}
            onChange={(event) => {
              setRangeError(null);
              setMaxPopulation(event.target.value);
            }}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="tramo-price" className="mb-1 block text-sm font-medium text-text-form">
            {t("plataforma.contratos.annualPriceLabel")}
          </label>
          <input
            id="tramo-price"
            type="number"
            step="0.01"
            min="0"
            value={priceEuros}
            onChange={(event) => setPriceEuros(event.target.value)}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-text-form">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="h-4 w-4"
        />
        {t("plataforma.contratos.tierActiveLabel")}
      </label>

      {rangeError ? (
        <p id="tramo-rango-error" role="alert" className="text-sm text-error">
          {t(rangeError)}
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

function TramosTab({ canManage }: { canManage: boolean }) {
  const t = useTranslations();
  const tiers = useTiers();
  const [editing, setEditing] = useState<PricingTier | "new" | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <div>
          <Button type="button" onClick={() => setEditing("new")}>
            {t("plataforma.contratos.newTier")}
          </Button>
        </div>
      ) : null}

      {tiers.isError ? (
        <ErrorState
          title={t("plataforma.contratos.tiersLoadError")}
          description={errorKindText(tiers.error, TIERS_QUERY_ERROR_KEYS, t, "errors.tiersQuery.desconocido")}
        />
      ) : !tiers.data ? (
        <p className="text-sm text-text-secondary">{t("plataforma.contratos.tiersLoading")}</p>
      ) : tiers.data.length === 0 ? (
        <EmptyState title={t("plataforma.contratos.tiersEmptyTitle")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {tiers.data.map((tier) => (
            <li key={tier.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-text-base">{tier.name}</p>
                    <p className="text-sm text-text-secondary">
                      {tier.max_population != null
                        ? t("plataforma.contratos.populationRangeCapped", {
                            min: tier.min_population ?? 0,
                            max: tier.max_population,
                          })
                        : t("plataforma.contratos.populationRangeUncapped", {
                            min: tier.min_population ?? 0,
                          })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-base">
                      {formatEuros(tier.annual_price_cents)}
                      {t("plataforma.contratos.perYear")}
                    </span>
                    <Badge tone={tier.is_active ? "success" : "neutral"}>
                      {tier.is_active
                        ? t("plataforma.contratos.tierActive")
                        : t("plataforma.contratos.tierInactive")}
                    </Badge>
                    {canManage ? (
                      <Button type="button" variant="secondary" onClick={() => setEditing(tier)}>
                        {t("entidad.programaFicha.edit")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        titleId="tramo-dialog-title"
        title={editing === "new" ? t("plataforma.contratos.newTier") : t("plataforma.contratos.editTier")}
        onClose={() => setEditing(null)}
      >
        {editing !== null ? <TierForm editing={editing} onDone={() => setEditing(null)} /> : null}
      </Dialog>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Facturas                                                                */
/* ---------------------------------------------------------------------- */

interface FacturasTabProps {
  canManage: boolean;
  selectedContractId: number | string | null;
  onSelectContract: (contractId: number | string | null) => void;
}

function FacturasTab({ canManage, selectedContractId, onSelectContract }: FacturasTabProps) {
  const t = useTranslations();
  const locale = useLocale();
  const contracts = useContracts();
  const invoices = useInvoices(selectedContractId ?? undefined);
  const payInvoice = usePayInvoice();
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [paidOn, setPaidOn] = useState("");
  const [paidOnError, setPaidOnError] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="facturas-contract" className="mb-1 block text-sm font-medium text-text-form">
          {t("plataforma.contratos.contractLabel")}
        </label>
        <select
          id="facturas-contract"
          value={selectedContractId ?? ""}
          onChange={(event) => onSelectContract(event.target.value ? Number(event.target.value) : null)}
          className="w-full max-w-md rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        >
          <option value="">{t("plataforma.contratos.chooseContract")}</option>
          {contracts.data?.map((contract) => (
            <option key={contract.id} value={contract.id}>
              {contract.organization.name} — {contract.tier.name} ({formatDate(contract.starts_on, locale)} –{" "}
              {formatDate(contract.ends_on, locale)})
            </option>
          ))}
        </select>
      </div>

      {selectedContractId === null ? (
        <EmptyState title={t("plataforma.contratos.chooseContractEmpty")} />
      ) : (
        <>
          {canManage ? (
            <div>
              <Button type="button" onClick={() => setCreating(true)}>
                {t("plataforma.contratos.newInvoice")}
              </Button>
            </div>
          ) : null}

          {invoices.isError ? (
            <ErrorState
              title={t("plataforma.contratos.invoicesLoadError")}
              description={errorKindText(invoices.error, INVOICES_QUERY_ERROR_KEYS, t, "errors.invoicesQuery.desconocido")}
            />
          ) : !invoices.data ? (
            <p className="text-sm text-text-secondary">{t("plataforma.contratos.invoicesLoading")}</p>
          ) : invoices.data.length === 0 ? (
            <EmptyState title={t("plataforma.contratos.invoicesEmptyTitle")} />
          ) : (
            <Table<Invoice>
              caption={t("plataforma.contratos.invoicesTableCaption")}
              getRowKey={(invoice) => String(invoice.id)}
              rows={invoices.data}
              columns={[
                { key: "number", header: t("plataforma.contratos.invoiceNumberLabel"), render: (i) => i.number },
                { key: "amount", header: t("plataforma.contratos.colAmount"), render: (i) => formatEuros(i.amount_cents) },
                {
                  key: "issued",
                  header: t("plataforma.contratos.colIssued"),
                  render: (i) => formatDate(i.issued_on, locale),
                },
                { key: "due", header: t("plataforma.contratos.colDue"), render: (i) => formatDate(i.due_on, locale) },
                {
                  key: "paid",
                  header: t("plataforma.contratos.colPaid"),
                  render: (i) => (i.paid_on ? formatDate(i.paid_on, locale) : "—"),
                },
                {
                  key: "status",
                  header: t("plataforma.reportes.statusLabel"),
                  render: (i) => {
                    const status = invoiceStatus(i);
                    return <Badge tone={INVOICE_STATUS_TONES[status]}>{t(INVOICE_STATUS_LABEL_KEYS[status])}</Badge>;
                  },
                },
                {
                  key: "acciones",
                  header: t("common.actions"),
                  render: (i) =>
                    canManage && invoiceStatus(i) !== "paid" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          payInvoice.reset();
                          setPaidOnError(false);
                          setPaying(i);
                          setPaidOn(new Date().toISOString().slice(0, 10));
                        }}
                      >
                        {t("plataforma.contratos.markPaid")}
                      </Button>
                    ) : (
                      "—"
                    ),
                },
              ]}
            />
          )}

          <Dialog
            open={creating}
            titleId="factura-dialog-title"
            title={t("plataforma.contratos.newInvoice")}
            onClose={() => setCreating(false)}
          >
            <FacturaForm contractId={selectedContractId} onDone={() => setCreating(false)} />
          </Dialog>

          <ConfirmDialog
            open={paying !== null}
            title={t("plataforma.contratos.markPaidConfirmTitle")}
            description={
              <div className="flex flex-col gap-2">
                <p>
                  {t("plataforma.contratos.markPaidDescription", {
                    number: paying?.number ?? "",
                    amount: paying ? formatEuros(paying.amount_cents) : "",
                  })}
                </p>
                <label htmlFor="factura-paid-on" className="block text-sm font-medium text-text-form">
                  {t("plataforma.contratos.paidOnLabel")}
                </label>
                <input
                  id="factura-paid-on"
                  type="date"
                  value={paidOn}
                  aria-describedby={paidOnError ? "factura-paid-on-error" : undefined}
                  onChange={(event) => {
                    setPaidOnError(false);
                    setPaidOn(event.target.value);
                  }}
                  className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
                />
                {paidOnError ? (
                  <p id="factura-paid-on-error" role="alert" className="text-error">
                    {t("plataforma.contratos.paidOnRequiredError")}
                  </p>
                ) : null}
                {/* El error de la llamada también se lee aquí: el diálogo
                    solo se cierra si el pago se registra de verdad. */}
                {payInvoice.isError ? (
                  <p role="alert" className="text-error">
                    {errorKindText(payInvoice.error, PAY_INVOICE_ERROR_KEYS, t, "errors.payInvoice.desconocido")}
                  </p>
                ) : null}
              </div>
            }
            confirmLabel={t("plataforma.contratos.markPaid")}
            pending={payInvoice.isPending}
            onCancel={() => {
              payInvoice.reset();
              setPaidOnError(false);
              setPaying(null);
            }}
            onConfirm={() => {
              if (!paying) return;
              if (!paidOn) {
                setPaidOnError(true);
                return;
              }
              setPaidOnError(false);
              payInvoice.mutate(
                { invoiceId: paying.id, contractId: selectedContractId, paidOn },
                { onSuccess: () => setPaying(null) },
              );
            }}
          />
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Panel                                                                   */
/* ---------------------------------------------------------------------- */

export function ContratosPanel({ role }: ContratosPanelProps) {
  const t = useTranslations();
  const canManage = role === "superadmin";
  const [section, setSection] = useState<Section>("contratos");
  const [selectedContractId, setSelectedContractId] = useState<number | string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">{t("plataforma.contratos.sectionsLegend")}</legend>
        {SECTIONS.map((value) => (
          <Button
            key={value}
            type="button"
            variant={section === value ? "primary" : "secondary"}
            aria-pressed={section === value}
            onClick={() => setSection(value)}
          >
            {t(SECTION_LABEL_KEYS[value])}
          </Button>
        ))}
      </fieldset>

      {section === "contratos" ? (
        <ContratosTab
          canManage={canManage}
          onViewInvoices={(contractId) => {
            setSelectedContractId(contractId);
            setSection("facturas");
          }}
        />
      ) : null}
      {section === "tramos" ? <TramosTab canManage={canManage} /> : null}
      {section === "facturas" ? (
        <FacturasTab
          canManage={canManage}
          selectedContractId={selectedContractId}
          onSelectContract={setSelectedContractId}
        />
      ) : null}
    </div>
  );
}
