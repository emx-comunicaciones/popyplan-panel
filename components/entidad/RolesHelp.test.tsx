import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { RolesHelp } from "./RolesHelp";

describe("RolesHelp", () => {
  it("explica los seis roles, con «Voluntario/a» ya traducido, y la guardia", async () => {
    const { container } = render(<RolesHelp />);
    await userEvent.click(screen.getByText("¿Qué puede hacer cada rol?"));

    for (const label of ["Titular", "Moderador/a", "Dinamizador/a", "Analista", "Referente", "Voluntario/a"]) {
      expect(screen.getByText(label, { selector: "dt" })).toBeTruthy();
    }
    expect(screen.getByText(/Acompaña a las personas que la entidad le asigna/)).toBeTruthy();
    expect(screen.getByText(/No entra en el panel/)).toBeTruthy();
    expect(screen.getByText(/persona de guardia.*salvo que su rol sea Voluntario\/a/)).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });
});
