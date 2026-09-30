"use client";

/**
 * Ficha de una comunidad para la plataforma (admin de plataforma,
 * bloque 3, 2026-09-26). Cuatro bloques:
 *
 * - **Datos** (`GET /api/communities/{id}/`), con el estado activa/
 *   desactivada — que el listado no trae.
 * - **Acciones**: Desactivar/Reactivar (`PATCH {is_active}`) y Borrar
 *   comunidad (`DELETE`, borrado real que se lleva también su chat), las
 *   dos con `ConfirmDialog` y el error dentro (patrón M6-M10). Enlace a
 *   sus actividades (`/plataforma/actividades?community=<id>`).
 * - **Miembros**: la misma gestión que usa la entidad
 *   (`CommunityMembersSection` de `ComunidadesPanel.tsx`): el backend
 *   concede `can_manage` también a `is_staff`.
 * - **Publicaciones** (`GET /api/community-posts/?community=`): ocultar/
 *   mostrar (reversible, sin confirmación) y borrar (con confirmación).
 *
 * Nada de esto queda en Auditoría: el backend no audita ninguna de estas
 * acciones (ver CLAUDE.md).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { CommunityMembersSection } from "@/components/entidad/ComunidadesPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  useDeletePlatformCommunity,
  usePlatformCommunity,
  useSetPlatformCommunityActive,
} from "@/hooks/usePlatformCommunities";
import { errorKindText } from "@/lib/i18n/errorKindText";

import {
  COMMUNITY_SPACE_KEYS,
  COMMUNITY_VISIBILITY_KEYS,
  PLATFORM_COMMUNITIES_ERROR_KEYS,
  labelOf,
} from "./ComunidadesPlataformaTable";
import { PublicacionesTable } from "./PublicacionesTable";
import { formatAccountDate } from "./UsuariosTable";

const FALLBACK_KEY = "errors.platformCommunities.desconocido";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="font-medium text-text-form">{label}</dt>
      <dd className="text-text-base">{children}</dd>
    </div>
  );
}

export interface ComunidadPlataformaDetailProps {
  communityId: string;
}

export function ComunidadPlataformaDetail({ communityId }: ComunidadPlataformaDetailProps) {
  const t = useTranslations();
  const router = useRouter();
  const community = usePlatformCommunity(communityId);
  const setActive = useSetPlatformCommunityActive(communityId);
  const remove = useDeletePlatformCommunity(communityId);
  const [confirming, setConfirming] = useState<"active" | "delete" | null>(null);

  if (community.isError) {
    return community.error.kind === "no_encontrado" ? (
      <EmptyState title={t("plataforma.comunidadFicha.notFound")} />
    ) : (
      <ErrorState
        title={t("plataforma.comunidadFicha.loadError")}
        description={errorKindText(community.error, PLATFORM_COMMUNITIES_ERROR_KEYS, t, FALLBACK_KEY)}
      />
    );
  }
  if (!community.data) {
    return <p className="text-sm text-text-secondary">{t("common.loading")}</p>;
  }

  const data = community.data;

  function closeConfirm() {
    setActive.reset();
    remove.reset();
    setConfirming(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title={data.name}>
        <dl className="flex flex-col gap-1 text-sm">
          <Row label={t("plataforma.comunidades.stateHeader")}>
            <Badge tone={data.is_active ? "success" : "error"}>
              {data.is_active ? t("plataforma.comunidades.activeBadge") : t("plataforma.comunidades.inactiveBadge")}
            </Badge>
          </Row>
          <Row label={t("plataforma.comunidades.ownerHeader")}>
            {data.owner.name}
            {" · "}
            {data.owner.type === "organization"
              ? t("plataforma.comunidades.ownerOrganization")
              : t("plataforma.comunidades.ownerProfile")}
          </Row>
          <Row label={t("plataforma.comunidades.visibilityHeader")}>
            {labelOf(COMMUNITY_VISIBILITY_KEYS, data.visibility, t)}
          </Row>
          <Row label={t("plataforma.comunidades.spaceHeader")}>{labelOf(COMMUNITY_SPACE_KEYS, data.space, t)}</Row>
          <Row label={t("plataforma.comunidades.membersHeader")}>{data.members_count}</Row>
          <Row label={t("plataforma.comunidadFicha.placeLabel")}>
            {data.place ? t("plataforma.sede.resolved", { name: data.place.name, province: data.place.prov_name }) : "—"}
          </Row>
          <Row label={t("plataforma.comunidadFicha.categoryLabel")}>{data.category?.name ?? "—"}</Row>
          <Row label={t("plataforma.comunidades.createdHeader")}>{formatAccountDate(data.created_at)}</Row>
          {data.description ? (
            <Row label={t("plataforma.comunidadFicha.descriptionLabel")}>{data.description}</Row>
          ) : null}
        </dl>
      </Card>

      <Card title={t("plataforma.comunidadFicha.actionsTitle")}>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setConfirming("active")}>
            {data.is_active ? t("plataforma.comunidadFicha.deactivate") : t("plataforma.comunidadFicha.reactivate")}
          </Button>
          <Link
            href={`/plataforma/actividades?community=${encodeURIComponent(communityId)}`}
            className="inline-flex min-h-8 items-center rounded-md border border-border bg-white px-3 py-1 text-sm font-medium text-primary-700 underline"
          >
            {t("plataforma.comunidadFicha.viewEvents")}
          </Link>
          <Button type="button" variant="danger" onClick={() => setConfirming("delete")}>
            {t("plataforma.comunidadFicha.delete")}
          </Button>
        </div>
      </Card>

      <Card title={t("plataforma.comunidadFicha.membersTitle")}>
        <CommunityMembersSection communityId={communityId} />
      </Card>

      <Card title={t("plataforma.comunidadFicha.postsTitle")}>
        <PublicacionesTable communityId={communityId} />
      </Card>

      <ConfirmDialog
        open={confirming === "active"}
        title={
          data.is_active ? t("plataforma.comunidadFicha.deactivateTitle") : t("plataforma.comunidadFicha.reactivateTitle")
        }
        description={
          <>
            <span>
              {data.is_active
                ? t("plataforma.comunidadFicha.deactivateDescription")
                : t("plataforma.comunidadFicha.reactivateDescription")}
            </span>
            {setActive.isError ? (
              <span role="alert" className="mt-2 block text-error">
                {errorKindText(setActive.error, PLATFORM_COMMUNITIES_ERROR_KEYS, t, FALLBACK_KEY)}
              </span>
            ) : null}
          </>
        }
        confirmLabel={data.is_active ? t("plataforma.comunidadFicha.deactivate") : t("plataforma.comunidadFicha.reactivate")}
        pending={setActive.isPending}
        onCancel={closeConfirm}
        onConfirm={() => setActive.mutate(!data.is_active, { onSuccess: () => setConfirming(null) })}
      />

      <ConfirmDialog
        open={confirming === "delete"}
        title={t("plataforma.comunidadFicha.deleteTitle")}
        description={
          <>
            <span>{t("plataforma.comunidadFicha.deleteDescription", { name: data.name })}</span>
            {remove.isError ? (
              <span role="alert" className="mt-2 block text-error">
                {errorKindText(remove.error, PLATFORM_COMMUNITIES_ERROR_KEYS, t, FALLBACK_KEY)}
              </span>
            ) : null}
          </>
        }
        confirmLabel={t("plataforma.comunidadFicha.delete")}
        pending={remove.isPending}
        onCancel={closeConfirm}
        onConfirm={() => remove.mutate(undefined, { onSuccess: () => router.push("/plataforma/comunidades") })}
      />
    </div>
  );
}
