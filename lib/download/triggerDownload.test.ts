import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { triggerDownload } from "@/lib/download/triggerDownload";

const createObjectURLMock = vi.fn(() => "blob:mock-url");
const revokeObjectURLMock = vi.fn();

beforeEach(() => {
  // jsdom no implementa `URL.createObjectURL`/`revokeObjectURL` (son APIs
  // de navegador): mismo apaño que en los tests de `useExport`.
  vi.stubGlobal(
    "URL",
    Object.assign(URL, { createObjectURL: createObjectURLMock, revokeObjectURL: revokeObjectURLMock }),
  );
});

afterEach(() => {
  createObjectURLMock.mockClear();
  revokeObjectURLMock.mockClear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("triggerDownload", () => {
  it("pincha un <a download> temporal y lo quita del documento", () => {
    const blob = new Blob(["a,b\n1,2"], { type: "text/csv" });
    const atClick: { download?: string; href?: string | null; connected?: boolean } = {};
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function click(this: HTMLAnchorElement) {
        atClick.download = this.download;
        atClick.href = this.getAttribute("href");
        atClick.connected = this.isConnected;
      });

    triggerDownload(blob, "informe-enero.csv");

    expect(createObjectURLMock).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(atClick.download).toBe("informe-enero.csv");
    expect(atClick.href).toBe("blob:mock-url");
    // Mientras se pincha tiene que estar en el documento (un <a> suelto
    // no dispara la descarga en todos los navegadores), y salir después.
    expect(atClick.connected).toBe(true);
    expect(document.querySelector("a[download]")).toBeNull();

    clickSpy.mockRestore();
  });

  it("libera la URL del blob en el siguiente turno, no durante la descarga", () => {
    vi.useFakeTimers();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    triggerDownload(new Blob(["x"]), "informe.csv");

    // Revocar en la misma vuelta cancela la descarga en algunos
    // navegadores: la URL sigue viva hasta el siguiente turno.
    expect(revokeObjectURLMock).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url");

    clickSpy.mockRestore();
  });
});
