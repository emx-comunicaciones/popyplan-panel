import { describe, expect, it, vi } from "vitest";

const getServerLanguageMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/i18n/serverLanguage", () => ({ getServerLanguage: getServerLanguageMock }));

import requestConfig from "./request";
import ca from "../messages/ca.json";
import es from "../messages/es.json";
import eu from "../messages/eu.json";

describe("i18n/request", () => {
  it("resuelve el locale (es) y carga su catálogo", async () => {
    getServerLanguageMock.mockResolvedValue("es");

    const config = await requestConfig({ requestLocale: Promise.resolve(undefined) });

    expect(config.locale).toBe("es");
    expect(config.messages).toEqual(es);
  });

  it("carga el catálogo de otro idioma (eu)", async () => {
    getServerLanguageMock.mockResolvedValue("eu");

    const config = await requestConfig({ requestLocale: Promise.resolve(undefined) });

    expect(config.locale).toBe("eu");
    expect(config.messages).toEqual(eu);
  });

  it("carga el catálogo de catalán", async () => {
    getServerLanguageMock.mockResolvedValue("ca");

    const config = await requestConfig({ requestLocale: Promise.resolve(undefined) });

    expect(config.locale).toBe("ca");
    expect(config.messages).toEqual(ca);
  });
});
