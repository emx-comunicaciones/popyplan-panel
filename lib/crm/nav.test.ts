import { describe, expect, it } from "vitest";

import { CRM_BASE, crmAccountHref, crmOpportunityHref, crmSectionHref, crmSectionsFor } from "./nav";

describe("menú del CRM", () => {
  it("el dashboard es la raíz de la pestaña; el resto cuelga de ella", () => {
    expect(crmSectionHref("dashboard")).toBe(CRM_BASE);
    expect(crmSectionHref("pipeline")).toBe(`${CRM_BASE}/pipeline`);
    expect(crmAccountHref(3)).toBe(`${CRM_BASE}/entidades/3`);
    expect(crmOpportunityHref(30)).toBe(`${CRM_BASE}/oportunidades/30`);
  });

  it("configuración solo para dirección comercial y administración", () => {
    expect(crmSectionsFor("sales")).not.toContain("configuracion");
    expect(crmSectionsFor("sales")).toHaveLength(11);
    expect(crmSectionsFor("sales_lead")).toContain("configuracion");
    expect(crmSectionsFor("superadmin")).toHaveLength(12);
  });
});
