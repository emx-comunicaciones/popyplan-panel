import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetch: apiFetchMock };
});

import { ApiError } from "@/lib/api/client";
import { buildBillingSummary, buildContract, buildInvoice, buildPricingTier } from "@/test-utils/fixtures/billing";

import {
  BillingError,
  useActivateContract,
  useBillingSummary,
  useContracts,
  useCreateContract,
  useCreateInvoice,
  useCreateTier,
  useEndContract,
  useInvoices,
  usePayInvoice,
  useTiers,
  useUpdateContract,
  useUpdateTier,
} from "./useBilling";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useBillingSummary", () => {
  it("pide el resumen de plataforma", async () => {
    const summary = buildBillingSummary();
    apiFetchMock.mockResolvedValueOnce(summary);

    const { result } = renderHook(() => useBillingSummary(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/plataforma/billing/summary/");
    expect(result.current.data).toEqual(summary);
  });

  it("403 surge como sin_acceso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useBillingSummary(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(BillingError);
    expect((result.current.error as BillingError).kind).toBe("sin_acceso");
  });
});

describe("useTiers", () => {
  it("pide los tramos de precio", async () => {
    const tier = buildPricingTier();
    apiFetchMock.mockResolvedValueOnce([tier]);

    const { result } = renderHook(() => useTiers(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/plataforma/billing/tiers/");
    expect(result.current.data).toEqual([tier]);
  });

  it("cualquier fallo surge como BillingError", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useTiers(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(BillingError);
  });
});

describe("useCreateTier", () => {
  it("manda POST /api/plataforma/billing/tiers/", async () => {
    apiFetchMock.mockResolvedValueOnce(buildPricingTier());

    const fields = {
      name: "Municipio grande",
      min_population: 20000,
      max_population: null,
      annual_price_cents: 400000,
      is_active: true,
    };
    const { result } = renderHook(() => useCreateTier(), { wrapper });
    result.current.mutate(fields);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/plataforma/billing/tiers/", {
      method: "POST",
      body: fields,
    });
  });

  it("403 (support escribiendo) surge con el mensaje literal del backend", async () => {
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(403, { detail: "Esta acción es solo para superadmin de plataforma." }),
    );

    const { result } = renderHook(() => useCreateTier(), { wrapper });
    result.current.mutate({
      name: "X",
      min_population: 0,
      max_population: null,
      annual_price_cents: 100,
      is_active: true,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as BillingError;
    expect(error.kind).toBe("sin_acceso");
    expect(error.message).toBe("Esta acción es solo para superadmin de plataforma.");
  });
});

describe("useUpdateTier", () => {
  it("manda PATCH /api/plataforma/billing/tiers/{id}/ solo con los campos tocados", async () => {
    apiFetchMock.mockResolvedValueOnce(buildPricingTier({ name: "Nuevo nombre" }));

    const { result } = renderHook(() => useUpdateTier(), { wrapper });
    result.current.mutate({ tierId: 3, name: "Nuevo nombre" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/plataforma/billing/tiers/3/", {
      method: "PATCH",
      body: { name: "Nuevo nombre" },
    });
  });

  it("404 surge como no_encontrado", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));

    const { result } = renderHook(() => useUpdateTier(), { wrapper });
    result.current.mutate({ tierId: 999, name: "X" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as BillingError).kind).toBe("no_encontrado");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useUpdateTier(), { wrapper });
    result.current.mutate({ tierId: 3, name: "X" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as BillingError).kind).toBe("desconocido");
  });
});

describe("useContracts", () => {
  it("sin filtros pide la lista completa", async () => {
    const contract = buildContract();
    apiFetchMock.mockResolvedValueOnce([contract]);

    const { result } = renderHook(() => useContracts(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/plataforma/billing/contracts/");
    expect(result.current.data).toEqual([contract]);
  });

  it("con filtros añade ?organization=&status=", async () => {
    apiFetchMock.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useContracts({ organization: 7, status: "active" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/plataforma/billing/contracts/?organization=7&status=active",
    );
  });

  it("cualquier fallo surge como BillingError", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useContracts(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(BillingError);
  });
});

describe("useCreateContract", () => {
  it("manda POST /api/plataforma/billing/contracts/ con los campos", async () => {
    apiFetchMock.mockResolvedValueOnce(buildContract());

    const fields = { organization: 7, tier: 1, starts_on: "2026-01-01", ends_on: "2026-12-31", notes: "" };
    const { result } = renderHook(() => useCreateContract(), { wrapper });
    result.current.mutate(fields);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/plataforma/billing/contracts/", {
      method: "POST",
      body: fields,
    });
  });

  it("400 surge como invalido con el mensaje del backend", async () => {
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(400, { ends_on: ["La fecha de fin no puede ser anterior a la de inicio."] }),
    );

    const { result } = renderHook(() => useCreateContract(), { wrapper });
    result.current.mutate({ organization: 7, tier: 1, starts_on: "2026-01-01", ends_on: "2025-01-01", notes: "" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as BillingError;
    expect(error.kind).toBe("invalido");
    expect(error.message).toBe("La fecha de fin no puede ser anterior a la de inicio.");
  });
});

describe("useUpdateContract", () => {
  it("manda PATCH /api/plataforma/billing/contracts/{id}/", async () => {
    apiFetchMock.mockResolvedValueOnce(buildContract({ notes: "Renovado" }));

    const { result } = renderHook(() => useUpdateContract(), { wrapper });
    result.current.mutate({ contractId: 3, notes: "Renovado" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/plataforma/billing/contracts/3/", {
      method: "PATCH",
      body: { notes: "Renovado" },
    });
  });

  it("409 (contrato ended) surge como conflicto con el mensaje literal", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(409, { detail: "Un contrato finalizado no se modifica." }));

    const { result } = renderHook(() => useUpdateContract(), { wrapper });
    result.current.mutate({ contractId: 3, notes: "X" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as BillingError;
    expect(error.kind).toBe("conflicto");
    expect(error.message).toBe("Un contrato finalizado no se modifica.");
  });
});

describe("useActivateContract", () => {
  it("manda POST .../activate/ sin cuerpo", async () => {
    apiFetchMock.mockResolvedValueOnce(buildContract({ status: "active" }));

    const { result } = renderHook(() => useActivateContract(), { wrapper });
    result.current.mutate(3);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/plataforma/billing/contracts/3/activate/", {
      method: "POST",
    });
  });

  it("409 surge como conflicto", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(409, {}));

    const { result } = renderHook(() => useActivateContract(), { wrapper });
    result.current.mutate(3);

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as BillingError;
    expect(error.kind).toBe("conflicto");
    expect(error.message).toBe("Esta acción no es válida en el estado actual.");
  });
});

describe("useEndContract", () => {
  it("manda POST .../end/ sin cuerpo", async () => {
    apiFetchMock.mockResolvedValueOnce(buildContract({ status: "ended" }));

    const { result } = renderHook(() => useEndContract(), { wrapper });
    result.current.mutate(3);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/plataforma/billing/contracts/3/end/", { method: "POST" });
  });

  it("cualquier fallo surge como BillingError con el mensaje por defecto", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useEndContract(), { wrapper });
    result.current.mutate(3);

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as BillingError;
    expect(error.kind).toBe("desconocido");
    expect(error.message).toBe("No se pudo finalizar el contrato.");
  });
});

describe("useInvoices", () => {
  it("pide las facturas del contrato", async () => {
    const invoice = buildInvoice();
    apiFetchMock.mockResolvedValueOnce([invoice]);

    const { result } = renderHook(() => useInvoices(3), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiFetchMock).toHaveBeenCalledWith("/api/plataforma/billing/contracts/3/invoices/");
    expect(result.current.data).toEqual([invoice]);
  });

  it("cualquier fallo surge como BillingError", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useInvoices(3), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(BillingError);
  });

  it("sin contractId no pide nada (query deshabilitada)", () => {
    const { result } = renderHook(() => useInvoices(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});

describe("useCreateInvoice", () => {
  it("manda POST .../contracts/{id}/invoices/ con los campos", async () => {
    apiFetchMock.mockResolvedValueOnce(buildInvoice());

    const { result } = renderHook(() => useCreateInvoice(), { wrapper });
    result.current.mutate({
      contractId: 3,
      number: "2026-0002",
      amount_cents: 60000,
      issued_on: "2026-01-05",
      due_on: "2026-02-05",
      notes: "",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/plataforma/billing/contracts/3/invoices/", {
      method: "POST",
      body: {
        number: "2026-0002",
        amount_cents: 60000,
        issued_on: "2026-01-05",
        due_on: "2026-02-05",
        notes: "",
      },
    });
  });

  it("400 (número duplicado) surge como invalido con el mensaje del backend", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { number: ["Ya existe una factura con ese número."] }));

    const { result } = renderHook(() => useCreateInvoice(), { wrapper });
    result.current.mutate({
      contractId: 3,
      number: "2026-0001",
      amount_cents: 60000,
      issued_on: "2026-01-05",
      due_on: "2026-02-05",
      notes: "",
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as BillingError;
    expect(error.kind).toBe("invalido");
    expect(error.message).toBe("Ya existe una factura con ese número.");
  });
});

describe("usePayInvoice", () => {
  it("manda POST /api/plataforma/billing/invoices/{id}/pay/ {paid_on}", async () => {
    apiFetchMock.mockResolvedValueOnce(buildInvoice({ paid_on: "2026-02-01", status: "paid" }));

    const { result } = renderHook(() => usePayInvoice(), { wrapper });
    result.current.mutate({ invoiceId: 5, contractId: 3, paidOn: "2026-02-01" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/plataforma/billing/invoices/5/pay/", {
      method: "POST",
      body: { paid_on: "2026-02-01" },
    });
  });

  it("403 surge como sin_acceso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => usePayInvoice(), { wrapper });
    result.current.mutate({ invoiceId: 5, contractId: 3, paidOn: "2026-02-01" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as BillingError).kind).toBe("sin_acceso");
  });
});
