import { describe, expect, it, vi } from "vitest";

import { singleFlight } from "./singleFlight";

describe("singleFlight", () => {
  it("dos llamadas concurrentes con la misma clave comparten una sola ejecución", async () => {
    const map = new Map<string, Promise<string>>();
    let resolveFn: (value: string) => void = () => undefined;
    const fn = vi.fn(() => new Promise<string>((resolve) => (resolveFn = resolve)));

    const first = singleFlight(map, "clave", fn);
    const second = singleFlight(map, "clave", fn);
    resolveFn("valor");

    expect(await first).toBe("valor");
    expect(await second).toBe("valor");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("claves distintas no se comparten", async () => {
    const map = new Map<string, Promise<string>>();
    const fn = vi.fn((value: string) => Promise.resolve(value));

    const [a, b] = await Promise.all([
      singleFlight(map, "a", () => fn("a")),
      singleFlight(map, "b", () => fn("b")),
    ]);

    expect([a, b]).toEqual(["a", "b"]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("libera la entrada al terminar: una llamada posterior vuelve a ejecutar", async () => {
    const map = new Map<string, Promise<string>>();
    const fn = vi.fn(() => Promise.resolve("valor"));

    await singleFlight(map, "clave", fn);
    expect(map.size).toBe(0);
    await singleFlight(map, "clave", fn);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("libera la entrada también cuando la ejecución falla", async () => {
    const map = new Map<string, Promise<string>>();
    const fn = vi.fn(() => Promise.reject(new Error("boom")));

    await expect(singleFlight(map, "clave", fn)).rejects.toThrow("boom");

    expect(map.size).toBe(0);
  });
});
