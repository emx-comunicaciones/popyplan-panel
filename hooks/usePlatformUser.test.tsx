/**
 * `USERS.DETAIL` (GET/PATCH/DELETE), `AUTH.ADMIN_REGISTER` y
 * `AUTH.PASSWORD_RESET` (admin de plataforma, bloque 1).
 */
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
import { buildPlatformAccount, buildPlatformPublicProfile } from "@/test-utils/fixtures/platformAccount";

import {
  PlatformProfileError,
  PlatformUserMutationError,
  useCreatePlatformUser,
  useDeletePlatformUser,
  usePlatformUserProfile,
  useSendPasswordReset,
  useSetPlatformUserActive,
} from "./usePlatformUser";

afterEach(() => {
  apiFetchMock.mockReset();
});

let queryClient: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
function freshClient() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return queryClient;
}

describe("usePlatformUserProfile", () => {
  it("pide el perfil público", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce(buildPlatformPublicProfile());
    const { result } = renderHook(() => usePlatformUserProfile("13"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/users/13/");
  });

  it("404 (cuenta inexistente o suspendida) es no_encontrado", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, { error: "User not found" }));
    const { result } = renderHook(() => usePlatformUserProfile("13"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(PlatformProfileError);
    expect(result.current.error?.kind).toBe("no_encontrado");
  });

  it("otro fallo es desconocido", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(500, null));
    const { result } = renderHook(() => usePlatformUserProfile("13"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });
});

describe("useCreatePlatformUser", () => {
  it("da de alta la cuenta e invalida el listado", async () => {
    const client = freshClient();
    client.setQueryData(["panel-platform-users", "", null, null, 1], { results: [] });
    const account = buildPlatformAccount({ id: 300 });
    apiFetchMock.mockResolvedValueOnce(account);
    const { result } = renderHook(() => useCreatePlatformUser(), { wrapper });
    result.current.mutate({ email: "nueva@test.com", username: "nueva" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(account);
    expect(apiFetchMock).toHaveBeenCalledWith("/api/auth/admin-register/", {
      method: "POST",
      body: { email: "nueva@test.com", username: "nueva" },
    });
    expect(client.getQueryState(["panel-platform-users", "", null, null, 1])?.isInvalidated).toBe(true);
  });

  it("400 conserva el mensaje literal del backend por campo", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { email: ["Ya existe un usuario con este correo."] }));
    const { result } = renderHook(() => useCreatePlatformUser(), { wrapper });
    result.current.mutate({ email: "x@test.com", username: "x" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(PlatformUserMutationError);
    expect(result.current.error?.kind).toBe("invalido");
    expect(result.current.error?.detail).toBe("Ya existe un usuario con este correo.");
  });

  it("400 sin mensaje legible cae al genérico", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));
    const { result } = renderHook(() => useCreatePlatformUser(), { wrapper });
    result.current.mutate({ email: "x@test.com", username: "x" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.detail).toBeUndefined();
    expect(result.current.error?.message).toBe("Revisa los datos.");
  });

  it.each([
    [403, "sin_permiso"],
    [404, "no_encontrado"],
    [429, "demasiados_intentos"],
    [500, "desconocido"],
  ])("traduce un %s a %s", async (status, kind) => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(status, null));
    const { result } = renderHook(() => useCreatePlatformUser(), { wrapper });
    result.current.mutate({ email: "x@test.com", username: "x" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe(kind);
  });

  it("un fallo de red es desconocido", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new TypeError("red"));
    const { result } = renderHook(() => useCreatePlatformUser(), { wrapper });
    result.current.mutate({ email: "x@test.com", username: "x" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });
});

describe("useSetPlatformUserActive", () => {
  it("manda is_active e invalida la cuenta (clave con id en string)", async () => {
    const client = freshClient();
    client.setQueryData(["panel-platform-account", "13", "x@test.com"], { account: null, isActive: true });
    client.setQueryData(["panel-platform-user-profile", "13"], buildPlatformPublicProfile());
    apiFetchMock.mockResolvedValueOnce(buildPlatformAccount());
    const { result } = renderHook(() => useSetPlatformUserActive("13"), { wrapper });
    result.current.mutate(false);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/users/13/", { method: "PATCH", body: { is_active: false } });
    expect(client.getQueryState(["panel-platform-account", "13", "x@test.com"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["panel-platform-user-profile", "13"])?.isInvalidated).toBe(true);
  });

  it("403 es sin_permiso", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, { error: "No" }));
    const { result } = renderHook(() => useSetPlatformUserActive("13"), { wrapper });
    result.current.mutate(true);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("sin_permiso");
  });
});

describe("useDeletePlatformUser", () => {
  it("borra la cuenta", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useDeletePlatformUser("13"), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/users/13/", { method: "DELETE" });
  });

  it("400 (la propia cuenta) trae el `error` literal del backend", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { error: "No puedes borrar tu propia cuenta desde aquí" }));
    const { result } = renderHook(() => useDeletePlatformUser("13"), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.detail).toBe("No puedes borrar tu propia cuenta desde aquí");
  });
});

describe("useSendPasswordReset", () => {
  it("manda el correo a la ruta de restablecimiento", async () => {
    freshClient();
    apiFetchMock.mockResolvedValueOnce({ detail: "ok" });
    const { result } = renderHook(() => useSendPasswordReset(), { wrapper });
    result.current.mutate("x@test.com");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/auth/password/reset/", {
      method: "POST",
      body: { email: "x@test.com" },
    });
  });

  it("429 es demasiados_intentos", async () => {
    freshClient();
    apiFetchMock.mockRejectedValueOnce(new ApiError(429, null));
    const { result } = renderHook(() => useSendPasswordReset(), { wrapper });
    result.current.mutate("x@test.com");
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("demasiados_intentos");
  });
});
