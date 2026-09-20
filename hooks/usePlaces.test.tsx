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
import { buildPlaceRow } from "@/test-utils/fixtures/places";

import { usePlacesByIne, usePlacesCount, useSearchPlaces } from "./usePlaces";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("usePlaces", () => {
  it("usePlacesByIne pide los municipios por código y sigue las páginas", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        count: 2,
        next: "http://x/api/places/?ine_code=20069%2C20045&page=2",
        previous: null,
        results: [buildPlaceRow()],
      })
      .mockResolvedValueOnce({
        count: 2,
        next: null,
        previous: null,
        results: [buildPlaceRow({ ine_code: "20045", name: "Hondarribia" })],
      });

    const { result } = renderHook(() => usePlacesByIne(["20069", "20045"]), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, "/api/places/?ine_code=20069%2C20045");
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, "/api/places/?ine_code=20069%2C20045&page=2");
    expect(result.current.data?.map((place) => place.name)).toEqual(["Irun", "Hondarribia"]);
  });

  it("usePlacesByIne sin códigos no pide nada y devuelve lista vacía", () => {
    const { result } = renderHook(() => usePlacesByIne([]), { wrapper });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it("usePlacesByIne lanza 'demasiadas_paginas' si el backend no termina nunca", async () => {
    apiFetchMock.mockResolvedValue({
      count: 9999,
      next: "http://x/api/places/?page=2",
      previous: null,
      results: [buildPlaceRow()],
    });

    const { result } = renderHook(() => usePlacesByIne(["20069"]), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("demasiadas_paginas");
    expect(apiFetchMock).toHaveBeenCalledTimes(25);
  });

  it("useSearchPlaces solo pide con dos caracteres o más, y una sola página", async () => {
    const short = renderHook(() => useSearchPlaces("i"), { wrapper });
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(short.result.current.data).toBeUndefined();

    apiFetchMock.mockResolvedValue({
      count: 1,
      next: "http://x/api/places/?search=irun&page=2",
      previous: null,
      results: [buildPlaceRow()],
    });
    const { result } = renderHook(() => useSearchPlaces("irun"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledExactlyOnceWith("/api/places/?search=irun");
    expect(result.current.data).toHaveLength(1);
  });

  it("un fallo del listado es kind 'desconocido'", async () => {
    apiFetchMock.mockRejectedValue(new ApiError(500, {}));

    const { result } = renderHook(() => useSearchPlaces("irun"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });

  /**
   * I4 de la revisión final de rama: si `GET /api/places/` acabara
   * sirviendo un array plano (sin el envoltorio paginado de DRF) — el
   * mismo tipo de sorpresa que ya le pasó al panel con
   * `GET /api/safety/reports/queue/`, documentado en `CLAUDE.md` — los
   * tres hooks leían `results`/`count`/`next` de un valor `undefined` y
   * degradaban a «vacío» sin ningún error: el mapa decía «ningún
   * municipio con actividad», el buscador de sede nunca encontraba nada
   * y la vista previa decía «0 municipios», los tres sin un solo aviso.
   */
  it("usePlacesByIne lanza 'desconocido' si la respuesta no trae el envoltorio paginado (I4)", async () => {
    apiFetchMock.mockResolvedValue([buildPlaceRow()]);

    const { result } = renderHook(() => usePlacesByIne(["20069"]), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });

  it("useSearchPlaces lanza 'desconocido' si la respuesta no trae el envoltorio paginado (I4)", async () => {
    apiFetchMock.mockResolvedValue([buildPlaceRow()]);

    const { result } = renderHook(() => useSearchPlaces("irun"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });

  it("usePlacesCount lanza 'desconocido' si la respuesta no trae el envoltorio paginado (I4)", async () => {
    apiFetchMock.mockResolvedValue([buildPlaceRow()]);

    const { result } = renderHook(() => usePlacesCount("provincia", "20"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });

  it("usePlacesCount traduce cada atajo a su filtro y devuelve solo el total", async () => {
    apiFetchMock.mockResolvedValue({ count: 88, next: null, previous: null, results: [] });

    const { result } = renderHook(() => usePlacesCount("provincia", "20"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledExactlyOnceWith("/api/places/?prov_code=20");
    expect(result.current.data).toBe(88);
  });

  it("usePlacesCount usa ccaa_code y comarca_code para los otros dos atajos", async () => {
    apiFetchMock.mockResolvedValue({ count: 3, next: null, previous: null, results: [] });

    const ccaa = renderHook(() => usePlacesCount("ccaa", "16"), { wrapper });
    await waitFor(() => expect(ccaa.result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/places/?ccaa_code=16");

    const comarca = renderHook(() => usePlacesCount("comarca", "C1"), { wrapper });
    await waitFor(() => expect(comarca.result.current.isSuccess).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/places/?comarca_code=C1");
  });

  it("usePlacesCount no pide nada sin atajo, con «municipios» o sin código", () => {
    renderHook(() => usePlacesCount("", "20"), { wrapper });
    renderHook(() => usePlacesCount("municipios", "20069,20045"), { wrapper });
    renderHook(() => usePlacesCount("provincia", "   "), { wrapper });

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("un fallo de la vista previa es kind 'desconocido'", async () => {
    apiFetchMock.mockRejectedValue(new ApiError(500, {}));

    const { result } = renderHook(() => usePlacesCount("provincia", "20"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("desconocido");
  });
});
