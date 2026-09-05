import type { PlatformRoleMe } from "@/lib/api/types";

export function buildPlatformRole(role: PlatformRoleMe["role"] = null): PlatformRoleMe {
  return { role };
}
