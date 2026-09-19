import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test-utils/render";
import { axe } from "@/test-utils/axe";
import { NextRedirectSignal } from "@/test-utils/nextNavigationMock";
import { buildMe, buildOrgMembership } from "@/test-utils/fixtures/me";
import { buildFamiliesSummary, buildFamiliesSummaryCommunityRow } from "@/test-utils/fixtures/families";

const getServerSessionMock = vi.hoisted(() => vi.fn());
const useFamiliesSummaryMock = vi.hoisted(() => vi.fn());
const useToggleCrossSpaceMock = vi.hoisted(() => vi.fn());
const useCreateFamiliesCommunityMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getServerSession: getServerSessionMock }));
vi.mock("@/hooks/useFamiliesSummary", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useFamiliesSummary")>(
    "@/hooks/useFamiliesSummary",
  );
  return { ...actual, useFamiliesSummary: useFamiliesSummaryMock };
});
vi.mock("@/hooks/useToggleCrossSpace", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useToggleCrossSpace")>(
    "@/hooks/useToggleCrossSpace",
  );
  return { ...actual, useToggleCrossSpace: useToggleCrossSpaceMock };
});
vi.mock("@/hooks/useCreateFamiliesCommunity", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useCreateFamiliesCommunity")>(
    "@/hooks/useCreateFamiliesCommunity",
  );
  return { ...actual, useCreateFamiliesCommunity: useCreateFamiliesCommunityMock };
});

import EntidadFamiliasPage, { generateMetadata } from "./page";

afterEach(() => {
  getServerSessionMock.mockReset();
  useFamiliesSummaryMock.mockReset();
  useToggleCrossSpaceMock.mockReset();
  useCreateFamiliesCommunityMock.mockReset();
});

function mockMutationDefaults() {
  useToggleCrossSpaceMock.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  });
  useCreateFamiliesCommunityMock.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  });
}

async function renderPage(role = "titular", slug = "alfaville") {
  getServerSessionMock.mockResolvedValue({
    token: "t",
    me: buildMe({
      org_memberships: [buildOrgMembership({ role, organization_slug: slug, organization_id: 7 })],
    }),
    platformRole: { role: null },
  });

  const element = await EntidadFamiliasPage({ params: Promise.resolve({ slug }) });
  render(element);
}

describe("EntidadFamiliasPage", () => {
  it("expone el título de la página vía generateMetadata", async () => {
    expect((await generateMetadata()).title).toBe("Familias");
  });

  it("no tiene violaciones de accesibilidad (axe)", async () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({
      data: buildFamiliesSummary({
        communities: [buildFamiliesSummaryCommunityRow()],
      }),
      isError: false,
      error: null,
    });

    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "alfaville", organization_id: 7 })],
      }),
      platformRole: { role: null },
    });
    const element = await EntidadFamiliasPage({ params: Promise.resolve({ slug: "alfaville" }) });
    const { container } = render(element);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("titular ve el resumen, el banner de separación y la lista de comunidades", async () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({
      data: buildFamiliesSummary({
        communities: [buildFamiliesSummaryCommunityRow({ name: "Familias Alfaville" })],
      }),
      isError: false,
      error: null,
    });

    await renderPage("titular");

    expect(screen.getByRole("heading", { name: "Familias" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Las comunidades de familias están separadas de las de miembros; nadie declara ser familiar de nadie.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Familias Alfaville")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva comunidad de familias" })).toBeInTheDocument();
  });

  it("moderador también gestiona (ve «Nueva comunidad de familias»)", async () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({ data: buildFamiliesSummary(), isError: false, error: null });

    await renderPage("moderador");

    expect(screen.getByRole("button", { name: "Nueva comunidad de familias" })).toBeInTheDocument();
  });

  it("dinamizador ve el espacio en modo solo lectura (sin gestión)", async () => {
    mockMutationDefaults();
    useFamiliesSummaryMock.mockReturnValue({
      data: buildFamiliesSummary({
        communities: [buildFamiliesSummaryCommunityRow({ name: "Familias Alfaville" })],
      }),
      isError: false,
      error: null,
    });

    await renderPage("dinamizador");

    expect(screen.getByText("Familias Alfaville")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Nueva comunidad de familias" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: "Permitir cruce de espacios" }),
    ).not.toBeInTheDocument();
  });

  it("analista ve «Sin acceso» (Familias no está en su menú)", async () => {
    await renderPage("analista");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("referente ve «Sin acceso»", async () => {
    await renderPage("referente");

    expect(screen.getByText("Sin acceso")).toBeInTheDocument();
  });

  it("sin sesión redirige a /login", async () => {
    getServerSessionMock.mockResolvedValue(null);

    await expect(
      EntidadFamiliasPage({ params: Promise.resolve({ slug: "alfaville" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/login" } satisfies Partial<NextRedirectSignal>));
  });

  it("sin membresía en esa entidad redirige a /", async () => {
    getServerSessionMock.mockResolvedValue({
      token: "t",
      me: buildMe({
        org_memberships: [buildOrgMembership({ role: "titular", organization_slug: "alfaville" })],
      }),
      platformRole: { role: null },
    });

    await expect(
      EntidadFamiliasPage({ params: Promise.resolve({ slug: "otra-entidad" }) }),
    ).rejects.toEqual(expect.objectContaining({ url: "/" } satisfies Partial<NextRedirectSignal>));
  });
});
