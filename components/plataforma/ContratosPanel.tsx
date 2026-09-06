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
 */
import { useState, type FormEvent } from "react";

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
  type ContractsFilters,
} from "@/hooks/useBilling";
import { useOrganizations } from "@/hooks/useOrganizations";
import type { Contract, ContractStatus, Invoice, InvoiceStatus, PricingTier } from "@/lib/api/types";
import { formatEuros } from "@/lib/programs/money";

import { ContratoForm } from "./ContratoForm";
import { FacturaForm } from "./FacturaForm";

export interface ContratosPanelProps {
  role: string | null;
}

const SECTIONS = ["contratos", "tramos", "facturas"] as const;
type Section = (typeof SECTIONS)[number];
const SECTION_LABELS: Record<Section, string> = {
  contratos: "Contratos",
  tramos: "Tramos",
  facturas: "Facturas",
};

const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "Borrador",
  active: "Vigente",
  ended: "Finalizado",
};
const CONTRACT_STATUS_TONES: Record<ContractStatus, BadgeTone> = {
  draft: "neutral",
  active: "success",
  ended: "info",
};

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  paid: "Pagada",
  pending: "Pendiente",
  overdue: "Vencida",
};
const INVOICE_STATUS_TONES: Record<InvoiceStatus, BadgeTone> = {
  paid: "success",
  pending: "neutral",
  overdue: "error",
};

function invoiceStatus(invoice: Invoice): InvoiceStatus {
  return (invoice.status as InvoiceStatus) in INVOICE_STATUS_LABELS ? (invoice.status as InvoiceStatus) : "pending";
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES");
}

/* ---------------------------------------------------------------------- */
/* Contratos                                                               */
/* ---------------------------------------------------------------------- */

interface ContratosTabProps {
  canManage: boolean;
  onViewInvoices: (contractId: number | string) => void;
}

function ContratosTab({ canManage, onViewInvoices }: ContratosTabProps) {
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
            Entidad
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
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          >
            <option value="">Todas</option>
            {organizations.data?.results.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="contratos-filter-status" className="mb-1 block text-sm font-medium text-text-form">
            Estado
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
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          >
            <option value="">Todos</option>
            <option value="draft">Borrador</option>
            <option value="active">Vigente</option>
            <option value="ended">Finalizado</option>
          </select>
        </div>
        {canManage ? (
          <Button type="button" onClick={() => setEditing("new")}>
            Nuevo contrato
          </Button>
        ) : null}
      </div>

      {contracts.isError ? (
        <ErrorState title="No se pudieron cargar los contratos" description={contracts.error.message} />
      ) : !contracts.data ? (
        <p className="text-sm text-text-secondary">Cargando contratos…</p>
      ) : contracts.data.length === 0 ? (
        <EmptyState title="Sin contratos con esos filtros" />
      ) : (
        <Table<Contract>
          caption="Contratos de plataforma"
          getRowKey={(contract) => String(contract.id)}
          rows={contracts.data}
          columns={[
            { key: "org", header: "Entidad", render: (c) => c.organization.name },
            { key: "tier", header: "Tramo", render: (c) => c.tier.name },
            {
              key: "vigencia",
              header: "Vigencia",
              render: (c) => `${formatDate(c.starts_on)} – ${formatDate(c.ends_on)}`,
            },
            {
              key: "estado",
              header: "Estado",
              render: (c) => (
                <Badge tone={CONTRACT_STATUS_TONES[c.status]}>{CONTRACT_STATUS_LABELS[c.status]}</Badge>
              ),
            },
            {
              key: "facturas",
              header: "Pendiente de cobro",
              render: (c) => `${formatEuros(c.pending_amount_cents)} (${c.invoices_count} facturas)`,
            },
            {
              key: "acciones",
              header: "Acciones",
              render: (c) => (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => onViewInvoices(c.id)}>
                    Ver facturas
                  </Button>
                  {canManage ? (
                    <Button type="button" variant="secondary" onClick={() => setEditing(c)}>
                      Editar
                    </Button>
                  ) : null}
                  {canManage && c.status === "draft" ? (
                    <Button type="button" disabled={activate.isPending} onClick={() => activate.mutate(c.id)}>
                      Activar
                    </Button>
                  ) : null}
                  {canManage && c.status === "active" ? (
                    <Button type="button" variant="danger" onClick={() => setEnding(c)}>
                      Finalizar
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
          {activate.error.message}
        </p>
      ) : null}

      <Dialog
        open={editing !== null}
        titleId="contrato-dialog-title"
        title={editing === "new" ? "Nuevo contrato" : "Editar contrato"}
        onClose={() => setEditing(null)}
      >
        {editing !== null ? <ContratoForm editing={editing} onDone={() => setEditing(null)} /> : null}
      </Dialog>

      <ConfirmDialog
        open={ending !== null}
        title="Finalizar contrato"
        description="La entidad deja de facturarse por este contrato. No afecta a su funcionamiento en el panel (invariante 7): sigue operando igual."
        confirmLabel="Finalizar"
        pending={endContract.isPending}
        onCancel={() => setEnding(null)}
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

  const mutation = editing === "new" ? createTier : updateTier;
  const priceCents = Math.round(Number(priceEuros.replace(",", ".")) * 100);
  const canSubmit = name.trim().length > 0 && priceEuros.trim().length > 0 && !Number.isNaN(priceCents);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    const fields = {
      name,
      min_population: Number(minPopulation) || 0,
      max_population: maxPopulation.trim() === "" ? null : Number(maxPopulation),
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
          Nombre
        </label>
        <input
          id="tramo-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <div>
          <label htmlFor="tramo-min" className="mb-1 block text-sm font-medium text-text-form">
            Población mínima
          </label>
          <input
            id="tramo-min"
            type="number"
            min="0"
            value={minPopulation}
            onChange={(event) => setMinPopulation(event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="tramo-max" className="mb-1 block text-sm font-medium text-text-form">
            Población máxima (vacío = sin tope)
          </label>
          <input
            id="tramo-max"
            type="number"
            min="0"
            value={maxPopulation}
            onChange={(event) => setMaxPopulation(event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="tramo-price" className="mb-1 block text-sm font-medium text-text-form">
            Precio anual (€)
          </label>
          <input
            id="tramo-price"
            type="number"
            step="0.01"
            min="0"
            value={priceEuros}
            onChange={(event) => setPriceEuros(event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
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
        Tramo activo (disponible para nuevos contratos)
      </label>

      <div className="flex gap-2">
        <Button type="submit" disabled={!canSubmit || mutation.isPending}>
          Guardar
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
      </div>
      {mutation.isError ? (
        <p role="alert" className="text-sm text-error">
          {mutation.error.message}
        </p>
      ) : null}
    </form>
  );
}

function TramosTab({ canManage }: { canManage: boolean }) {
  const tiers = useTiers();
  const [editing, setEditing] = useState<PricingTier | "new" | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <div>
          <Button type="button" onClick={() => setEditing("new")}>
            Nuevo tramo
          </Button>
        </div>
      ) : null}

      {tiers.isError ? (
        <ErrorState title="No se pudieron cargar los tramos" description={tiers.error.message} />
      ) : !tiers.data ? (
        <p className="text-sm text-text-secondary">Cargando tramos…</p>
      ) : tiers.data.length === 0 ? (
        <EmptyState title="Sin tramos todavía" />
      ) : (
        <ul className="flex flex-col gap-3">
          {tiers.data.map((tier) => (
            <li key={tier.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-text-base">{tier.name}</p>
                    <p className="text-sm text-text-secondary">
                      {tier.min_population ?? 0}
                      {tier.max_population != null ? ` – ${tier.max_population}` : "+"} habitantes
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-base">{formatEuros(tier.annual_price_cents)}/año</span>
                    <Badge tone={tier.is_active ? "success" : "neutral"}>
                      {tier.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                    {canManage ? (
                      <Button type="button" variant="secondary" onClick={() => setEditing(tier)}>
                        Editar
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
        title={editing === "new" ? "Nuevo tramo" : "Editar tramo"}
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
  const contracts = useContracts();
  const invoices = useInvoices(selectedContractId ?? undefined);
  const payInvoice = usePayInvoice();
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [paidOn, setPaidOn] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="facturas-contract" className="mb-1 block text-sm font-medium text-text-form">
          Contrato
        </label>
        <select
          id="facturas-contract"
          value={selectedContractId ?? ""}
          onChange={(event) => onSelectContract(event.target.value ? Number(event.target.value) : null)}
          className="w-full max-w-md rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
        >
          <option value="">Elige un contrato…</option>
          {contracts.data?.map((contract) => (
            <option key={contract.id} value={contract.id}>
              {contract.organization.name} — {contract.tier.name} ({formatDate(contract.starts_on)} –{" "}
              {formatDate(contract.ends_on)})
            </option>
          ))}
        </select>
      </div>

      {selectedContractId === null ? (
        <EmptyState title="Elige un contrato para ver sus facturas" />
      ) : (
        <>
          {canManage ? (
            <div>
              <Button type="button" onClick={() => setCreating(true)}>
                Nueva factura
              </Button>
            </div>
          ) : null}

          {invoices.isError ? (
            <ErrorState title="No se pudieron cargar las facturas" description={invoices.error.message} />
          ) : !invoices.data ? (
            <p className="text-sm text-text-secondary">Cargando facturas…</p>
          ) : invoices.data.length === 0 ? (
            <EmptyState title="Sin facturas todavía" />
          ) : (
            <Table<Invoice>
              caption="Facturas del contrato"
              getRowKey={(invoice) => String(invoice.id)}
              rows={invoices.data}
              columns={[
                { key: "number", header: "Número", render: (i) => i.number },
                { key: "amount", header: "Importe", render: (i) => formatEuros(i.amount_cents) },
                { key: "issued", header: "Emitida", render: (i) => formatDate(i.issued_on) },
                { key: "due", header: "Vence", render: (i) => formatDate(i.due_on) },
                { key: "paid", header: "Pagada", render: (i) => (i.paid_on ? formatDate(i.paid_on) : "—") },
                {
                  key: "status",
                  header: "Estado",
                  render: (i) => {
                    const status = invoiceStatus(i);
                    return <Badge tone={INVOICE_STATUS_TONES[status]}>{INVOICE_STATUS_LABELS[status]}</Badge>;
                  },
                },
                {
                  key: "acciones",
                  header: "Acciones",
                  render: (i) =>
                    canManage && invoiceStatus(i) !== "paid" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setPaying(i);
                          setPaidOn(new Date().toISOString().slice(0, 10));
                        }}
                      >
                        Marcar pagada
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
            title="Nueva factura"
            onClose={() => setCreating(false)}
          >
            <FacturaForm contractId={selectedContractId} onDone={() => setCreating(false)} />
          </Dialog>

          <ConfirmDialog
            open={paying !== null}
            title="Marcar factura como pagada"
            description={
              <div className="flex flex-col gap-2">
                <p>Factura {paying?.number}, {paying ? formatEuros(paying.amount_cents) : ""}.</p>
                <label htmlFor="factura-paid-on" className="block text-sm font-medium text-text-form">
                  Fecha de pago
                </label>
                <input
                  id="factura-paid-on"
                  type="date"
                  value={paidOn}
                  onChange={(event) => setPaidOn(event.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
                />
              </div>
            }
            confirmLabel="Marcar pagada"
            pending={payInvoice.isPending}
            onCancel={() => setPaying(null)}
            onConfirm={() => {
              if (!paying || !paidOn) return;
              payInvoice.mutate(
                { invoiceId: paying.id, contractId: selectedContractId, paidOn },
                { onSuccess: () => setPaying(null) },
              );
            }}
          />
          {payInvoice.isError ? (
            <p role="alert" className="text-sm text-error">
              {payInvoice.error.message}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Panel                                                                   */
/* ---------------------------------------------------------------------- */

export function ContratosPanel({ role }: ContratosPanelProps) {
  const canManage = role === "superadmin";
  const [section, setSection] = useState<Section>("contratos");
  const [selectedContractId, setSelectedContractId] = useState<number | string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">Secciones de contratación</legend>
        {SECTIONS.map((value) => (
          <Button
            key={value}
            type="button"
            variant={section === value ? "primary" : "secondary"}
            onClick={() => setSection(value)}
          >
            {SECTION_LABELS[value]}
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
