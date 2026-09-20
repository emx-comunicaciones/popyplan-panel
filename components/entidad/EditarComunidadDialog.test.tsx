import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { buildCommunityDetail, buildEntityCommunityRow } from "@/test-utils/fixtures/community";

const useCommunityMock = vi.hoisted(() => vi.fn());
const useUpdateCommunityMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useCommunity", () => ({ useCommunity: useCommunityMock }));
vi.mock("@/hooks/useUpdateCommunity", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useUpdateCommunity")>(
    "@/hooks/useUpdateCommunity",
  );
  return { ...actual, useUpdateCommunity: useUpdateCommunityMock };
});

import { EditarComunidadDialog } from "./EditarComunidadDialog";

afterEach(() => {
  useCommunityMock.mockReset();
  useUpdateCommunityMock.mockReset();
});

function idleMutation(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), isPending: false, isError: false, error: null, reset: vi.fn(), ...overrides };
}

describe("EditarComunidadDialog", () => {
  it("mientras carga la ficha, pinta el estado de carga en vez del formulario", () => {
    useCommunityMock.mockReturnValue({ data: undefined, isError: false, error: null });
    useUpdateCommunityMock.mockReturnValue(idleMutation());

    render(
      <EditarComunidadDialog
        orgId={7}
        community={buildEntityCommunityRow({ id: "c1" })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Cargando la ficha de la comunidad…")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
  });

  it("si la ficha falla al cargar, pinta el error en vez del formulario", () => {
    useCommunityMock.mockReturnValue({ data: undefined, isError: true, error: new Error("red caída") });
    useUpdateCommunityMock.mockReturnValue(idleMutation());

    render(
      <EditarComunidadDialog
        orgId={7}
        community={buildEntityCommunityRow({ id: "c1" })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("No se pudo cargar la ficha de la comunidad")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
  });

  it("con la ficha cargada, prellena el formulario con sus valores", () => {
    useCommunityMock.mockReturnValue({
      data: buildCommunityDetail({
        name: "Corredores",
        description: "Salimos los martes",
        visibility: "on_request",
        code_of_conduct: "Sé puntual",
      }),
      isError: false,
      error: null,
    });
    useUpdateCommunityMock.mockReturnValue(idleMutation());

    render(
      <EditarComunidadDialog
        orgId={7}
        community={buildEntityCommunityRow({ id: "c1" })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Editar comunidad" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Corredores");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Salimos los martes");
    expect(screen.getByLabelText("Visibilidad")).toHaveValue("on_request");
    expect(screen.getByLabelText("Código de conducta")).toHaveValue("Sé puntual");
  });

  it("«Guardar cambios» está deshabilitado hasta que algo cambia", async () => {
    useCommunityMock.mockReturnValue({
      data: buildCommunityDetail({ name: "Corredores", description: "", code_of_conduct: "" }),
      isError: false,
      error: null,
    });
    const mutate = vi.fn();
    useUpdateCommunityMock.mockReturnValue(idleMutation({ mutate }));

    const user = userEvent.setup();
    render(
      <EditarComunidadDialog
        orgId={7}
        community={buildEntityCommunityRow({ id: "c1" })}
        onClose={vi.fn()}
      />,
    );

    const submit = screen.getByRole("button", { name: "Guardar cambios" });
    expect(submit).toBeDisabled();

    await user.click(submit);
    expect(mutate).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Nombre"));
    await user.type(screen.getByLabelText("Nombre"), "Corredores del barrio");
    expect(submit).toBeEnabled();
  });

  it("al guardar, manda el payload con los campos editados y sin space", async () => {
    useCommunityMock.mockReturnValue({
      data: buildCommunityDetail({
        name: "Corredores",
        description: "Salimos los martes",
        visibility: "open",
        code_of_conduct: "",
      }),
      isError: false,
      error: null,
    });
    const mutate = vi.fn((_input, options?: { onSuccess?: (community: { id: string }) => void }) => {
      options?.onSuccess?.({ id: "c1" });
    });
    useUpdateCommunityMock.mockReturnValue(idleMutation({ mutate }));

    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <EditarComunidadDialog
        orgId={7}
        community={buildEntityCommunityRow({ id: "c1", space: "members" })}
        onClose={onClose}
      />,
    );

    await user.clear(screen.getByLabelText("Descripción"));
    await user.type(screen.getByLabelText("Descripción"), "Salimos los jueves");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(mutate).toHaveBeenCalledWith(
      {
        orgId: 7,
        communityId: "c1",
        space: "members",
        name: "Corredores",
        description: "Salimos los jueves",
        visibility: "open",
        codeOfConduct: "",
      },
      expect.anything(),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("con un error al guardar, pinta el mensaje dentro del diálogo", () => {
    useCommunityMock.mockReturnValue({
      data: buildCommunityDetail({ name: "Corredores" }),
      isError: false,
      error: null,
    });
    useUpdateCommunityMock.mockReturnValue(
      idleMutation({
        isError: true,
        error: Object.assign(new Error("Solo titular o moderador pueden editar una comunidad."), {
          kind: "sin_permiso",
        }),
      }),
    );

    render(
      <EditarComunidadDialog
        orgId={7}
        community={buildEntityCommunityRow({ id: "c1" })}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Solo titular o moderador pueden editar una comunidad.",
    );
  });

  it("«Cancelar» cierra el diálogo sin llamar a mutate", async () => {
    useCommunityMock.mockReturnValue({
      data: buildCommunityDetail({ name: "Corredores" }),
      isError: false,
      error: null,
    });
    const mutate = vi.fn();
    useUpdateCommunityMock.mockReturnValue(idleMutation({ mutate }));

    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <EditarComunidadDialog
        orgId={7}
        community={buildEntityCommunityRow({ id: "c1" })}
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(mutate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
