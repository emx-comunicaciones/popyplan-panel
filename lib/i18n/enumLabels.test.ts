import { describe, expect, it } from "vitest";

import {
  COMMUNITY_ROLE_LABEL_KEYS,
  ORG_ROLE_LABEL_KEYS,
  ORG_TYPE_LABEL_KEYS,
  REPORT_TARGET_LABEL_KEYS,
  enumLabel,
} from "./enumLabels";
import es from "@/messages/es.json";
import eu from "@/messages/eu.json";
import ca from "@/messages/ca.json";
import en from "@/messages/en.json";

function lookup(messages: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);
}

describe("enumLabels", () => {
  it("cada valor conocido tiene texto en los cuatro idiomas", () => {
    const all = [ORG_ROLE_LABEL_KEYS, COMMUNITY_ROLE_LABEL_KEYS, REPORT_TARGET_LABEL_KEYS, ORG_TYPE_LABEL_KEYS];
    for (const keys of all) {
      for (const key of Object.values(keys)) {
        for (const messages of [es, eu, ca, en]) {
          expect(typeof lookup(messages, key), key).toBe("string");
        }
      }
    }
  });

  it("traduce el valor conocido y deja pasar el desconocido", () => {
    const t = (key: string) => `t(${key})`;
    expect(enumLabel(COMMUNITY_ROLE_LABEL_KEYS, "owner", t)).toBe("t(enums.communityRole.owner)");
    expect(enumLabel(COMMUNITY_ROLE_LABEL_KEYS, "nuevo", t)).toBe("nuevo");
  });
});
