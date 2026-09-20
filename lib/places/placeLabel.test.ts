import { describe, expect, it } from "vitest";

import { buildPlaceRow } from "@/test-utils/fixtures/places";

import { placeLabelState, type PlaceQueryLike } from "./placeLabel";

const LOADING: PlaceQueryLike = { data: undefined, isPending: true, isError: false };
const ERROR: PlaceQueryLike = { data: undefined, isPending: false, isError: true };
const SUCCESS_EMPTY: PlaceQueryLike = { data: [], isPending: false, isError: false };
const SUCCESS_WITH_IRUN: PlaceQueryLike = { data: [buildPlaceRow()], isPending: false, isError: false };

describe("placeLabelState", () => {
  it("sin código INE, 'empty' (nunca pide nada, nunca resuelve nada)", () => {
    expect(placeLabelState(null, SUCCESS_WITH_IRUN)).toEqual({ kind: "empty" });
    expect(placeLabelState(undefined, SUCCESS_WITH_IRUN)).toEqual({ kind: "empty" });
    expect(placeLabelState("", SUCCESS_WITH_IRUN)).toEqual({ kind: "empty" });
  });

  it("con código y la consulta aún en curso, 'loading'", () => {
    expect(placeLabelState("20069", LOADING)).toEqual({ kind: "loading" });
  });

  it("con código y el municipio en la respuesta, 'resolved' con nombre y provincia", () => {
    expect(placeLabelState("20069", SUCCESS_WITH_IRUN)).toEqual({
      kind: "resolved",
      name: "Irun",
      province: "Gipuzkoa",
    });
  });

  it("con código pero sin ese municipio en la respuesta (o la consulta falló), 'fallback' — nunca inventa un nombre", () => {
    expect(placeLabelState("20069", SUCCESS_EMPTY)).toEqual({ kind: "fallback" });
    expect(placeLabelState("20069", ERROR)).toEqual({ kind: "fallback" });
  });
});
