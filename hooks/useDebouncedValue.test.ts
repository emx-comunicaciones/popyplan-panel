import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDebouncedValue } from "./useDebouncedValue";

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("devuelve el valor inicial sin esperar al retardo", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useDebouncedValue("ana"));

    expect(result.current).toBe("ana");
  });

  it("no publica el valor nuevo hasta que pasa el retardo", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: "a" },
    });

    rerender({ value: "ana" });
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("ana");
  });

  it("varios cambios seguidos colapsan en el último valor", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: "" },
    });

    for (const value of ["a", "an", "ana"]) {
      rerender({ value });
      act(() => vi.advanceTimersByTime(100));
    }

    // 300 ms desde el primer cambio, pero el reloj se reinició con cada
    // tecla: todavía no hay valor publicado.
    expect(result.current).toBe("");

    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe("ana");
  });

  it("admite un retardo propio", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: "a", delay: 1000 } },
    );

    rerender({ value: "ana", delay: 1000 });
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(700));
    expect(result.current).toBe("ana");
  });

  it("funciona con valores que no son cadenas", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: 1 },
    });

    rerender({ value: 2 });
    act(() => vi.advanceTimersByTime(300));

    expect(result.current).toBe(2);
  });

  it("al desmontar cancela el temporizador pendiente", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: "a" },
    });

    rerender({ value: "ana" });
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    // Sin la limpieza, el `setDebounced` pendiente saltaría sobre un
    // componente ya desmontado.
    expect(() => act(() => vi.advanceTimersByTime(300))).not.toThrow();
    clearTimeoutSpy.mockRestore();
  });
});
