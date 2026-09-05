import { afterEach, describe, expect, it } from "vitest";

import { awaitBootRestore, registerBootRestore, resetBootRestoreForTests } from "./bootSession";

afterEach(() => {
  resetBootRestoreForTests();
});

describe("bootSession", () => {
  it("sin registro previo, se resuelve enseguida", async () => {
    await expect(awaitBootRestore()).resolves.toBeUndefined();
  });

  it("espera a que la promesa registrada se resuelva", async () => {
    let resolveBoot: () => void = () => undefined;
    registerBootRestore(
      new Promise((resolve) => {
        resolveBoot = () => resolve(undefined);
      }),
    );

    let settled = false;
    const pending = awaitBootRestore().then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    resolveBoot();
    await pending;
    expect(settled).toBe(true);
  });

  it("una promesa registrada que falla no rompe a quien espera", async () => {
    registerBootRestore(Promise.reject(new Error("sin cookie")));

    await expect(awaitBootRestore()).resolves.toBeUndefined();
  });

  it("un segundo registro no sustituye al primero (ya en marcha)", async () => {
    let resolveFirst: (value: string) => void = () => undefined;
    registerBootRestore(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );
    registerBootRestore(Promise.resolve("segundo"));

    let observed: unknown;
    const pending = awaitBootRestore().then(() => {
      observed = "primero-resuelto";
    });
    resolveFirst("primero");
    await pending;

    expect(observed).toBe("primero-resuelto");
  });
});
