import type { Organization } from "@/lib/api/types";

export function buildOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: 7,
    name: "Asociación Vecinal Alfaville",
    slug: "asociacion-alfaville",
    org_type: "asociacion",
    is_verified: true,
    parent: null,
    description: "Asociación vecinal del barrio de Alfaville.",
    contact_email: "hola@alfaville.test",
    contact_phone: "+34600000000",
    help_phone: "+34600000001",
    website: "https://alfaville.test",
    logo: null,
    primary_color: "#1FB3AE",
    secondary_color: "#72C9EE",
    on_call_user: null,
    place: "20069",
    admin_level: "",
    territory_kind: "",
    territory_code: "",
    territory_places_count: 0,
    ...overrides,
  };
}
