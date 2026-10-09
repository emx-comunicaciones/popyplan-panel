import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";

const useCreateCommunityMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useCreateCommunity", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCreateCommunity")>(
    "@/hooks/useCreateCommunity",
  );
  return { ...actual, useCreateCommunity: useCreateCommunityMock };
});

import { NuevaComunidadDialog } from "./NuevaComunidadDialog";

afterEach(() => {
  useCreateCommunityMock.mockReset();
});

function idleMutation(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), isPending: false, isError: false, error: null, reset: vi.fn(), ...overrides };
}

describe("NuevaComunidadDialog", () => {
  it("space:'members' pinta el título y la frase de ayuda de Comunidades", () => {
    useCreateCommunityMock.mockReturnValue(idleMutation());

    render(<NuevaComunidadDialog orgId={7} space="members" open onClose={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Nueva comunidad" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "La comunidad será de la entidad y aparecerá en la app para las personas que puedan verla según su visibilidad.",
      ),
    ).toBeInTheDocument();
  });

  it("space:'families' pinta el título de Familias, sin la frase de ayuda de Comunidades", () => {
    useCreateCommunityMock.mockReturnValue(idleMutation());

    render(<NuevaComunidadDialog orgId={7} space="families" open onClose={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Nueva comunidad de familias" })).toBeInTheDocument();
    expect(
      screen.queryByText(
        "La comunidad será de la entidad y aparecerá en la app para las personas que puedan verla según su visibilidad.",
      ),
    ).not.toBeInTheDocument();
  });

  it("«Crear comunidad» está deshabilitado sin nombre, y no llama a mutate", async () => {
    const mutate = vi.fn();
    useCreateCommunityMock.mockReturnValue(idleMutation({ mutate }));

    const user = userEvent.setup();
    render(<NuevaComunidadDialog orgId={7} space="members" open onClose={vi.fn()} />);

    const submit = screen.getByRole("button", { name: "Crear comunidad" });
    expect(submit).toBeDisabled();

    await user.click(submit);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("con nombre, llama a mutate con space y orgId, y limpia el formulario al cerrar", async () => {
    const mutate = vi.fn((_input, options?: { onSuccess?: (community: { id: string }) => void }) => {
      options?.onSuccess?.({ id: "nueva-1" });
    });
    useCreateCommunityMock.mockReturnValue(idleMutation({ mutate }));

    const onClose = vi.fn();
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(<NuevaComunidadDialog orgId={7} space="members" open onClose={onClose} onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Nombre"), "Corredores");
    await user.click(screen.getByRole("button", { name: "Crear comunidad" }));

    expect(mutate).toHaveBeenCalledWith(
      {
        orgId: 7,
        space: "members",
        name: "Corredores",
        description: undefined,
        visibility: "open",
        codeOfConduct: undefined,
      },
      expect.anything(),
    );
    expect(onCreated).toHaveBeenCalledWith({ id: "nueva-1" });
    expect(onClose).toHaveBeenCalled();
  });

  it("space:'families' solo ofrece «Privada» y lo explica (decisión del 01-10: se entra por invitación)", async () => {
    const mutate = vi.fn();
    useCreateCommunityMock.mockReturnValue(idleMutation({ mutate }));

    const user = userEvent.setup();
    render(<NuevaComunidadDialog orgId={7} space="families" open onClose={vi.fn()} />);

    const visibility = screen.getByLabelText("Visibilidad");
    expect(visibility).toHaveValue("private");
    expect(visibility).toBeDisabled();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Privada"]);
    expect(visibility).toHaveAccessibleDescription(
      "En el espacio de familias la comunidad es siempre privada: solo se entra por invitación de la entidad.",
    );
    await user.type(screen.getByLabelText("Nombre"), "Familias");
    await user.click(screen.getByRole("button", { name: "Crear comunidad" }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ visibility: "private" }), expect.anything());
  });

  it("space:'members' sigue ofreciendo las cuatro visibilidades", () => {
    useCreateCommunityMock.mockReturnValue(idleMutation());
    render(<NuevaComunidadDialog orgId={7} space="members" open onClose={vi.fn()} />);
    expect(screen.getByLabelText("Visibilidad")).toBeEnabled();
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  it("con un error 400 sin detalle, pinta el mensaje genérico de creación de comunidad", () => {
    useCreateCommunityMock.mockReturnValue(
      idleMutation({
        isError: true,
        error: Object.assign(new Error("Revisa los datos: alguno no es válido."), { kind: "invalido" }),
      }),
    );

    render(<NuevaComunidadDialog orgId={7} space="members" open onClose={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Revisa los datos: alguno no es válido.");
  });
});
