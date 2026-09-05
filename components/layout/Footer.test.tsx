import { describe, expect, it } from "vitest";

import { render, screen } from "@/test-utils/render";

import { Footer } from "./Footer";

describe("Footer", () => {
  it("enlaza a la declaración de accesibilidad", () => {
    render(<Footer />);

    expect(screen.getByRole("link", { name: "Accesibilidad" })).toHaveAttribute(
      "href",
      "/accesibilidad",
    );
  });
});
