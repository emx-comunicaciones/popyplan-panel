/**
 * Cuerpo de `POST`/`PATCH /api/organizations/{org_id}/resources/(...)`
 * (`docs/PANEL.md` §7): con fichero, el contrato espera
 * `multipart/form-data` (`EntityResourceWriteRequest.file` es
 * `Format: binary`); sin fichero, JSON normal basta (y es más fácil de
 * testear). Esta función decide y construye el cuerpo una sola vez para
 * que `hooks/useCreateResource.ts` y `hooks/useUpdateResource.ts` (crear y
 * editar) no dupliquen la lógica.
 */
import type { ResourceAudience, ResourceCategory, ResourceKind } from "@/lib/api/types";

export interface ResourceFormInput {
  title?: string;
  category?: ResourceCategory;
  kind?: ResourceKind;
  body?: string;
  url?: string;
  file?: File | null;
  is_featured?: boolean;
  audience?: ResourceAudience;
}

const FORM_FIELDS = ["title", "category", "kind", "body", "url", "is_featured", "audience"] as const;

export function buildResourcePayload(input: ResourceFormInput): FormData | Record<string, unknown> {
  if (input.file) {
    const formData = new FormData();
    for (const field of FORM_FIELDS) {
      const value = input[field];
      if (value === undefined) continue;
      formData.append(field, typeof value === "boolean" ? String(value) : String(value));
    }
    formData.append("file", input.file);
    return formData;
  }

  const payload: Record<string, unknown> = {};
  for (const field of FORM_FIELDS) {
    const value = input[field];
    if (value !== undefined) payload[field] = value;
  }
  return payload;
}
