"use client";

/**
 * Inscripciones del programa de seguimiento de una entidad
 * (`docs/PANEL.md` §18.3): **estado y configuración, nunca datos de
 * seguimiento** de la persona. Solo `titular`/`moderador`
 * (`gestionar_seguimiento`) de una entidad con el servicio encendido; para
 * cualquier otra cuenta el backend responde **404** (nunca 403, no revela
 * que el programa existe) — por eso quien llama solo monta estos hooks con
 * ese rol y `tracking_program_enabled`, y un 404 del listado se trata como
 * «sin acceso», no como un fallo que pintar.
 *
 * `GET` es un **array plano** (verificado contra el backend sembrado: sin
 * paginador, `program/viewsets.py::EnrollmentListCreateView.get`).
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { detailOf } from "@/lib/api/drfError";
import { TRACKING } from "@/lib/api/endpoints";
import type {
  EnrollmentCreateInput,
  EnrollmentRow,
  EnrollmentStatus,
  EnrollmentUpdateInput,
} from "@/lib/api/types";

export type EnrollmentsErrorKind = "sin_acceso" | "desconocido";

export class EnrollmentsError extends Error {
  readonly kind: EnrollmentsErrorKind;

  constructor(kind: EnrollmentsErrorKind, message: string) {
    super(message);
    this.name = "EnrollmentsError";
    this.kind = kind;
  }
}

export interface EnrollmentFilters {
  status?: EnrollmentStatus;
  user?: number | string;
}

const ENROLLMENTS_KEY = "panel-program-enrollments";

export function useEnrollments(
  orgId: number | string,
  filters: EnrollmentFilters = {},
  enabled = true,
): UseQueryResult<EnrollmentRow[], EnrollmentsError> {
  const status = filters.status ?? "";
  const user = filters.user === undefined ? "" : String(filters.user);
  return useQuery<EnrollmentRow[], EnrollmentsError>({
    queryKey: [ENROLLMENTS_KEY, String(orgId), { status, user }],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (user) params.set("user", user);
      const query = params.toString();
      try {
        return await apiFetch<EnrollmentRow[]>(`${TRACKING.ENROLLMENTS(orgId)}${query ? `?${query}` : ""}`);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
          throw new EnrollmentsError("sin_acceso", "Sin acceso al programa de seguimiento.");
        }
        throw new EnrollmentsError("desconocido", "No se pudieron cargar las inscripciones del programa.");
      }
    },
  });
}

export type EnrollmentMutationErrorKind = "invalido" | "no_encontrado" | "conflicto" | "desconocido";

export class EnrollmentMutationError extends Error {
  readonly kind: EnrollmentMutationErrorKind;
  readonly detail?: string;

  constructor(kind: EnrollmentMutationErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "EnrollmentMutationError";
    this.kind = kind;
    this.detail = detail;
  }
}

/**
 * 400 (persona que no es de la entidad, `other` sin etiqueta, referente
 * que no es una membresía `referente`…) y 409 (ya tiene una inscripción
 * abierta aquí / ya está cerrada) llevan el texto del backend, que se
 * pinta tal cual. 404: la cuenta o la inscripción no existen (o el
 * servicio se apagó mientras tanto).
 */
function toEnrollmentMutationError(error: unknown, fallback: string): EnrollmentMutationError {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      const detail = detailOf(error);
      return new EnrollmentMutationError("invalido", detail ?? "Revisa los datos: alguno no es válido.", detail);
    }
    if (error.status === 404) {
      return new EnrollmentMutationError("no_encontrado", "Esta inscripción ya no está disponible.");
    }
    if (error.status === 409) {
      const detail = detailOf(error);
      return new EnrollmentMutationError("conflicto", detail ?? "Esta inscripción no admite esa acción.", detail);
    }
  }
  return new EnrollmentMutationError("desconocido", fallback);
}

function useInvalidateEnrollments(orgId: number | string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [ENROLLMENTS_KEY, String(orgId)] });
}

export function useCreateEnrollment(
  orgId: number | string,
): UseMutationResult<EnrollmentRow, EnrollmentMutationError, EnrollmentCreateInput> {
  const invalidate = useInvalidateEnrollments(orgId);
  return useMutation<EnrollmentRow, EnrollmentMutationError, EnrollmentCreateInput>({
    mutationFn: async (input) => {
      try {
        return await apiFetch<EnrollmentRow>(TRACKING.ENROLLMENTS(orgId), { method: "POST", body: input });
      } catch (error) {
        throw toEnrollmentMutationError(error, "No se pudo dar de alta en el programa.");
      }
    },
    onSuccess: () => {
      void invalidate();
    },
  });
}

export interface UpdateEnrollmentVariables {
  enrollmentId: number;
  changes: EnrollmentUpdateInput;
}

export function useUpdateEnrollment(
  orgId: number | string,
): UseMutationResult<EnrollmentRow, EnrollmentMutationError, UpdateEnrollmentVariables> {
  const invalidate = useInvalidateEnrollments(orgId);
  return useMutation<EnrollmentRow, EnrollmentMutationError, UpdateEnrollmentVariables>({
    mutationFn: async ({ enrollmentId, changes }) => {
      try {
        return await apiFetch<EnrollmentRow>(TRACKING.ENROLLMENT(orgId, enrollmentId), {
          method: "PATCH",
          body: changes,
        });
      } catch (error) {
        throw toEnrollmentMutationError(error, "No se pudo guardar la inscripción.");
      }
    },
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useCloseEnrollment(
  orgId: number | string,
): UseMutationResult<EnrollmentRow, EnrollmentMutationError, number> {
  const invalidate = useInvalidateEnrollments(orgId);
  return useMutation<EnrollmentRow, EnrollmentMutationError, number>({
    mutationFn: async (enrollmentId) => {
      try {
        return await apiFetch<EnrollmentRow>(TRACKING.ENROLLMENT_CLOSE(orgId, enrollmentId), { method: "POST" });
      } catch (error) {
        throw toEnrollmentMutationError(error, "No se pudo dar de baja del programa.");
      }
    },
    onSuccess: () => {
      void invalidate();
    },
  });
}
