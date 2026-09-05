import { describe, expect, it } from "vitest";

import { extensionOf, RESOURCE_MAX_MB, validateResourceFile } from "./validateFile";

describe("extensionOf", () => {
  it("devuelve la extensión en minúsculas", () => {
    expect(extensionOf("Guia.PDF")).toBe("pdf");
  });

  it("sin extensión devuelve cadena vacía", () => {
    expect(extensionOf("sinextension")).toBe("");
  });

  it("un nombre que termina en punto devuelve cadena vacía", () => {
    expect(extensionOf("nombre.")).toBe("");
  });
});

describe("validateResourceFile", () => {
  it("acepta un pdf dentro del límite", () => {
    expect(validateResourceFile({ name: "guia.pdf", size: 1024 })).toBeNull();
  });

  it("rechaza una extensión no permitida", () => {
    expect(validateResourceFile({ name: "virus.exe", size: 10 })).toMatch(
      /Tipo de fichero no permitido/,
    );
  });

  it("rechaza un fichero por encima del límite de tamaño", () => {
    const tooLarge = RESOURCE_MAX_MB * 1024 * 1024 + 1;
    expect(validateResourceFile({ name: "video.mp4", size: tooLarge })).toMatch(/supera el límite/);
  });

  it("acepta justo en el límite de tamaño", () => {
    const exact = RESOURCE_MAX_MB * 1024 * 1024;
    expect(validateResourceFile({ name: "audio.mp3", size: exact })).toBeNull();
  });
});
