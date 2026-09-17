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

import { InviteError, useInvite } from "./useInvite";

afterEach(() => {
  apiFetchMock.mockReset();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const INVITATION = {
  id: 3,
  organization: 7,
  email: "ana@example.com",
  display_name: "Ana",
  community: null,
  referent: null,
  status: "pending" as const,
  sent_at: "2026-09-05T10:00:00Z",
  accepted_at: null,
  invited_by: 1,
  created_at: "2026-09-05T10:00:00Z",
};

describe("useInvite", () => {
  it("manda email/display_name/phone/community/referent_user con sus valores por defecto", async () => {
    apiFetchMock.mockResolvedValueOnce(INVITATION);

    const { result } = renderHook(() => useInvite(7), { wrapper });
    result.current.mutate({ email: "ana@example.com" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/organizations/7/invitations/", {
      method: "POST",
      body: {
        email: "ana@example.com",
        display_name: "",
        phone: "",
        community: null,
        referent_user: null,
      },
    });
  });

  it("manda comunidad y referente cuando se eligen", async () => {
    apiFetchMock.mockResolvedValueOnce(INVITATION);

    const { result } = renderHook(() => useInvite(7), { wrapper });
    result.current.mutate({
      email: "ana@example.com",
      displayName: "Ana",
      phone: "600111222",
      community: "comm-1",
      referentUser: 9,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/organizations/7/invitations/",
      expect.objectContaining({
        body: expect.objectContaining({
          display_name: "Ana",
          phone: "600111222",
          community: "comm-1",
          referent_user: 9,
        }),
      }),
    );
  });

  it("400 con detalle surge como invalido", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { detail: "Comunidad desconocida." }));

    const { result } = renderHook(() => useInvite(7), { wrapper });
    result.current.mutate({ email: "ana@example.com" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as InviteError;
    expect(error.kind).toBe("invalido");
    expect(error.message).toBe("Comunidad desconocida.");
  });

  it("400 sin detalle cae al mensaje por defecto", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, null));

    const { result } = renderHook(() => useInvite(7), { wrapper });
    result.current.mutate({ email: "ana@example.com" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as InviteError).message).toBe("Revisa los datos: alguno no es válido.");
  });

  it("403 surge como sin_permiso", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(403, null));

    const { result } = renderHook(() => useInvite(7), { wrapper });
    result.current.mutate({ email: "ana@example.com" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as InviteError).kind).toBe("sin_permiso");
  });

  it("409 surge como ya_es_miembro con el mensaje exacto del brief", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(409, null));

    const { result } = renderHook(() => useInvite(7), { wrapper });
    result.current.mutate({ email: "ana@example.com" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const error = result.current.error as InviteError;
    expect(error.kind).toBe("ya_es_miembro");
    expect(error.message).toBe("Esta persona ya es miembro de la entidad.");
  });

  it("cualquier otro fallo surge como desconocido", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("red caída"));

    const { result } = renderHook(() => useInvite(7), { wrapper });
    result.current.mutate({ email: "ana@example.com" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as InviteError).kind).toBe("desconocido");
  });
});

/**
 * `lib/api/drfError.ts::detailOf`: el 400 por campo de DRF
 * (`{campo: ["mensaje"]}`) se pinta con el mensaje del backend, no con el
 * genérico del hook.
 */
describe("useInvite (400 por campo)", () => {
  it("muestra el mensaje del campo que el backend rechaza", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(400, { email: ["Introduce una dirección de correo válida."] }));
    const { result } = renderHook(() => useInvite(7), { wrapper });
    result.current.mutate({ email: "no-es-un-correo" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Introduce una dirección de correo válida.");
  });
});
