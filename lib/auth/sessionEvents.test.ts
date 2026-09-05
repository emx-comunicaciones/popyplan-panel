import { afterEach, describe, expect, it, vi } from "vitest";

import {
  consumeSessionExpiredMessage,
  notifySessionExpired,
  resetSessionEventsForTests,
  SESSION_EXPIRED_MESSAGE,
  subscribeSessionExpired,
} from "./sessionEvents";

afterEach(() => {
  resetSessionEventsForTests();
});

describe("sessionEvents", () => {
  it("avisa a quien esté suscrito", () => {
    const listener = vi.fn();
    subscribeSessionExpired(listener);

    notifySessionExpired();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("dejar de escuchar detiene los avisos", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSessionExpired(listener);
    unsubscribe();

    notifySessionExpired();

    expect(listener).not.toHaveBeenCalled();
  });

  it("consumeSessionExpiredMessage devuelve el mensaje por defecto y lo borra tras leerlo", () => {
    notifySessionExpired();

    expect(consumeSessionExpiredMessage()).toBe(SESSION_EXPIRED_MESSAGE);
    expect(consumeSessionExpiredMessage()).toBeNull();
  });

  it("admite un mensaje explícito", () => {
    notifySessionExpired("Mensaje a medida.");

    expect(consumeSessionExpiredMessage()).toBe("Mensaje a medida.");
  });

  it("sin ningún aviso, no hay mensaje pendiente", () => {
    expect(consumeSessionExpiredMessage()).toBeNull();
  });
});
