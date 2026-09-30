import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";

import { SearchPicker } from "./SearchPicker";

const OPTIONS = [
  { id: 4, label: "Ane" },
  { id: 7, label: "Beñat" },
];

function setup(overrides: Partial<React.ComponentProps<typeof SearchPicker>> = {}) {
  const onChange = vi.fn();
  const onQueryChange = vi.fn();
  render(
    <SearchPicker
      id="p"
      label="Persona"
      value={null}
      onChange={onChange}
      query=""
      onQueryChange={onQueryChange}
      options={OPTIONS}
      {...overrides}
    />,
  );
  return { onChange, onQueryChange };
}

describe("SearchPicker", () => {
  it("elegir una opción devuelve su id y vacía la búsqueda", async () => {
    const { onChange, onQueryChange } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Beñat" }));
    expect(onChange).toHaveBeenCalledWith({ id: 7, label: "Beñat" });
    expect(onQueryChange).toHaveBeenCalledWith("");
  });

  it("con una opción elegida enseña su nombre y «Cambiar» la quita", async () => {
    const { onChange } = setup({ value: OPTIONS[0] });
    expect(screen.getByRole("group", { name: "Persona" })).toHaveTextContent("Ane");
    await userEvent.click(screen.getByRole("button", { name: "Cambiar" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("avisa de los caracteres mínimos, de la carga, del error y de la lista vacía", () => {
    const { unmount } = render(
      <SearchPicker id="a" label="A" value={null} onChange={vi.fn()} query="a" onQueryChange={vi.fn()} options={undefined} minChars={2} />,
    );
    expect(screen.getByText("Escribe al menos 2 caracteres para buscar.")).toBeInTheDocument();
    unmount();

    const r2 = render(
      <SearchPicker id="a" label="A" value={null} onChange={vi.fn()} query="ana" onQueryChange={vi.fn()} options={undefined} loading />,
    );
    expect(screen.getByText("Buscando…")).toBeInTheDocument();
    r2.unmount();

    const r3 = render(
      <SearchPicker id="a" label="A" value={null} onChange={vi.fn()} query="ana" onQueryChange={vi.fn()} options={undefined} error />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo buscar");
    r3.unmount();

    render(<SearchPicker id="a" label="A" value={null} onChange={vi.fn()} query="ana" onQueryChange={vi.fn()} options={[]} />);
    expect(screen.getByText("Nada coincide con la búsqueda.")).toBeInTheDocument();
  });
});
