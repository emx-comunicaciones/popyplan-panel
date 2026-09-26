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
import { EVENTS } from "@/lib/api/endpoints";
import type { EventDetail } from "@/lib/api/types";

import { EventMutationError, useCancelEvent, useCreateEvent, useUpdateEvent } from "./useEventMutations";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const EVENT_DETAIL = { id: "e1", title: "Salida al monte" } as unknown as EventDetail;

const FULL_FIELDS = {
  title: "Salida al monte",
  description: "Ruta guiada",
  starts_at: "2027-01-01T10:00:00.000Z",
  ends_at: "2027-01-01T13:00:00.000Z",
  audience: "anyone" as const,
  community: null,
  capacity: 20,
  latitude: 43.337753,
  longitude: -1.792199,
};

describe("useCreateEvent", () => {
  it("manda POST /api/events/ con owner_org y todos los campos presentes", async () => {
    apiFetchMock.mockResolvedValueOnce(EVENT_DETAIL);

    const { result } = renderHook(() => useCreateEvent(7), { wrapper });
    result.current.mutate(FULL_FIELDS);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(EVENTS.LIST(), {
      method: "POST",
      body: {
        title: "Salida al monte",
        starts_at: "2027-01-01T10:00:00.000Z",
        audience: "anyone",
        owner_org: 7,
        description: "Ruta guiada",
        ends_at: "2027-01-01T13:00:00.000Z",
        capacity: 20,
        latitude: "43.337753",
        longitude: "-1.792199",
      },
    });
  });

  it("manda level si hay uno; «todos los niveles» (vacío) no viaja", async () => {
    apiFetchMock.mockResolvedValue(EVENT_DETAIL);

    const { result } = renderHook(() => useCreateEvent(7), { wrapper });
    result.current.mutate({ ...FULL_FIELDS, level: "beginner" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const withLevel = apiFetchMock.mock.calls[0][1] as { body: Record<string, unknown> };
    expect(withLevel.body.level).toBe("beginner");

    result.current.mutate({ ...FULL_FIELDS, level: "" });
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));
    const withoutLevel = apiFetchMock.mock.calls[1][1] as { body: Record<string, unknown> };
    expect(withoutLevel.body).not.toHaveProperty("level");
  });

  it("con audience=community solo manda community si hay una elegida", async () => {
    apiFetchMock.mockResolvedValueOnce(EVENT_DETAIL);

    const { result } = renderHook(() => useCreateEvent(7), { wrapper });
    result.current.mutate({
      ...FULL_FIELDS,
      description: "",
      ends_at: null,
      capacity: null,
      latitude: null,
      longitude: null,
      audience: "community",
      community: "c1",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(EVENTS.LIST(), {
      method: "POST",
      body: {
        title: "Salida al monte",
        starts_at: "2027-01-01T10:00:00.000Z",
        audience: "community",
        owner_org: 7,
        community: "c1",
      },
    });
  });

  it("con audience distinta de community, community no viaja aunque llegue informada", async () => {
    apiFetchMock.mockResolvedValueOnce(EVENT_DETAIL);

    const { result } = renderHook(() => useCreateEvent(7), { wrapper });
    result.current.mutate({
      ...FULL_FIELDS,
      description: "",
      ends_at: null,
      capacity: null,
      latitude: null,
      longitude: null,
      audience: "organization",
      community: "c1",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const call = apiFetchMock.mock.calls[0][1] as { body: Record<string, unknown> };
    expect(call.body).not.toHaveProperty("community");
  });

  it("400 con campo por campo surge como invalido con el mensaje literal", async () => {
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(400, { starts_at: ["La actividad tiene que empezar en el futuro."] }),
    );

    const { result } = renderHook(() => useCreateEvent(7), { wrapper });
    result.current.mutate(FULL_FIELDS);

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as EventMutationError;
    expect(error.kind).toBe("invalido");
    expect(error.message).toBe("La actividad tiene que empezar en el futuro.");
    expect(error.detail).toBe("La actividad tiene que empezar en el futuro.");
  });

  it("400 sin cuerpo cae al mensaje por defecto", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));

    const { result } = renderHook(() => useCreateEvent(7), { wrapper });
    result.current.mutate(FULL_FIELDS);

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as EventMutationError;
    expect(error.kind).toBe("invalido");
    expect(error.message).toBe("Revisa los datos: alguno no es válido.");
    expect(error.detail).toBeUndefined();
  });

  it("403 surge como sin_permiso con el detail literal cuando lo trae", async () => {
    apiFetchMock.mockRejectedValueOnce(
      new ApiError(403, { detail: "No tienes permiso para publicar actividades con el sello de esta entidad." }),
    );

    const { result } = renderHook(() => useCreateEvent(7), { wrapper });
    result.current.mutate(FULL_FIELDS);

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as EventMutationError;
    expect(error.kind).toBe("sin_permiso");
    expect(error.message).toBe(
      "No tienes permiso para publicar actividades con el sello de esta entidad.",
    );
  });

  it("403 sin cuerpo cae al mensaje por defecto", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useCreateEvent(7), { wrapper });
    result.current.mutate(FULL_FIELDS);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as EventMutationError).kind).toBe("sin_permiso");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useCreateEvent(7), { wrapper });
    result.current.mutate(FULL_FIELDS);

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as EventMutationError;
    expect(error.kind).toBe("desconocido");
    expect(error.message).toBe("No se pudo crear la actividad.");
  });

  it("invalida panel-entity-events de la entidad al tener éxito", async () => {
    apiFetchMock.mockResolvedValueOnce(EVENT_DETAIL);
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateEvent(7), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    result.current.mutate(FULL_FIELDS);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["panel-entity-events", 7] });
  });
});

describe("useUpdateEvent", () => {
  it("manda PATCH /api/events/{id}/ solo con las claves presentes", async () => {
    apiFetchMock.mockResolvedValueOnce(EVENT_DETAIL);

    const { result } = renderHook(() => useUpdateEvent(7), { wrapper });
    result.current.mutate({ eventId: "e1", title: "Nuevo título" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(EVENTS.DETAIL("e1"), {
      method: "PATCH",
      body: { title: "Nuevo título" },
    });
  });

  it("no manda starts_at si quien llama no lo incluyó (no cambió)", async () => {
    apiFetchMock.mockResolvedValueOnce(EVENT_DETAIL);

    const { result } = renderHook(() => useUpdateEvent(7), { wrapper });
    result.current.mutate({ eventId: "e1", description: "Nueva descripción" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const call = apiFetchMock.mock.calls[0][1] as { body: Record<string, unknown> };
    expect(call.body).not.toHaveProperty("starts_at");
  });

  it("level viaja si está presente, también vacío (vuelve a «todos los niveles»)", async () => {
    apiFetchMock.mockResolvedValue(EVENT_DETAIL);

    const { result } = renderHook(() => useUpdateEvent(7), { wrapper });
    result.current.mutate({ eventId: "e1", level: "" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenLastCalledWith(EVENTS.DETAIL("e1"), { method: "PATCH", body: { level: "" } });

    result.current.mutate({ eventId: "e1", level: "advanced" });
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenLastCalledWith(EVENTS.DETAIL("e1"), {
        method: "PATCH",
        body: { level: "advanced" },
      }),
    );
  });

  it("capacity: null borra el aforo explícitamente", async () => {
    apiFetchMock.mockResolvedValueOnce(EVENT_DETAIL);

    const { result } = renderHook(() => useUpdateEvent(7), { wrapper });
    result.current.mutate({ eventId: "e1", capacity: null });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(EVENTS.DETAIL("e1"), {
      method: "PATCH",
      body: { capacity: null },
    });
  });

  it("latitude/longitude se formatean como cadena; null se manda tal cual", async () => {
    apiFetchMock.mockResolvedValueOnce(EVENT_DETAIL);

    const { result } = renderHook(() => useUpdateEvent(7), { wrapper });
    result.current.mutate({ eventId: "e1", latitude: 43.1, longitude: null });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(EVENTS.DETAIL("e1"), {
      method: "PATCH",
      body: { latitude: "43.100000", longitude: null },
    });
  });

  it("404 surge como no_encontrado", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, null));

    const { result } = renderHook(() => useUpdateEvent(7), { wrapper });
    result.current.mutate({ eventId: "e1", title: "X" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as EventMutationError).kind).toBe("no_encontrado");
  });

  it("invalida panel-entity-events al tener éxito", async () => {
    apiFetchMock.mockResolvedValueOnce(EVENT_DETAIL);
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateEvent(7), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    result.current.mutate({ eventId: "e1", title: "X" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["panel-entity-events", 7] });
  });
});

describe("useCancelEvent", () => {
  it("manda POST /api/events/{id}/cancel/ sin cuerpo", async () => {
    apiFetchMock.mockResolvedValueOnce({ ...EVENT_DETAIL, status: "cancelled" });

    const { result } = renderHook(() => useCancelEvent(7), { wrapper });
    result.current.mutate("e1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(EVENTS.CANCEL("e1"), { method: "POST" });
  });

  it("403 surge como sin_permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useCancelEvent(7), { wrapper });
    result.current.mutate("e1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as EventMutationError).kind).toBe("sin_permiso");
  });

  it("invalida panel-entity-events al tener éxito", async () => {
    apiFetchMock.mockResolvedValueOnce(EVENT_DETAIL);
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCancelEvent(7), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    result.current.mutate("e1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["panel-entity-events", 7] });
  });
});
