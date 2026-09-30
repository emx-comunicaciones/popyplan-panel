import { describe, expect, it } from "vitest";

import { isValidPhone } from "./phone";

describe("isValidPhone", () => {
  it.each(["", "  ", "024", "900 123 456", "+34 943 123 456", "(943) 12-34-56", "+34.943.123.456", " 943123456 "])(
    "acepta %j",
    (value) => expect(isValidPhone(value)).toBe(true),
  );

  it.each(["hola", "12", "+34 abc 123", "1234567890123456", "++34943000000", "943-000-000x", "9+4300000"])(
    "rechaza %j",
    (value) => expect(isValidPhone(value)).toBe(false),
  );
});
