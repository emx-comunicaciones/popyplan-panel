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
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { CommunityMembersSection } from "@/components/entidad/ComunidadesPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  useDeleteCommunityPost,
  useDeletePlatformCommunity,
  usePlatformCommunity,
  usePlatformCommunityPosts,
  useSetCommunityPostActive,
  useSetPlatformCommunityActive,
} from "@/hooks/usePlatformCommunities";
import type { PlatformCommunityPost } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

import {
  COMMUNITY_SPACE_KEYS,
  COMMUNITY_VISIBILITY_KEYS,
  PLATFORM_COMMUNITIES_ERROR_KEYS,
  labelOf,
} from "./ComunidadesPlataformaTable";
import { formatAccountDate } from "./UsuariosTable";

const FALLBACK_KEY = "errors.platformCommunities.desconocido";
const EXCERPT_LENGTH = 140;

type PostFilter = "" | "true" | "false";

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
        <PostsSection communityId={communityId} />
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

function PostsSection({ communityId }: { communityId: string }) {
  const t = useTranslations();
  const [filter, setFilter] = useState<PostFilter>("");
  const [page, setPage] = useState(1);
  const posts = usePlatformCommunityPosts(communityId, {
    isActive: filter === "" ? undefined : filter === "true",
    page,
  });

  useEffect(() => {
    if (posts.error?.kind === "pagina_inexistente" && page > 1) setPage(1);
  }, [posts.error, page]);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor="posts-filter" className="mb-1 block text-sm font-medium text-text-form">
          {t("plataforma.comunidadFicha.postsFilterLabel")}
        </label>
        <select
          id="posts-filter"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value as PostFilter);
            setPage(1);
          }}
          className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
        >
          <option value="">{t("plataforma.comunidadFicha.postsFilterAll")}</option>
          <option value="true">{t("plataforma.comunidadFicha.postsFilterVisible")}</option>
          <option value="false">{t("plataforma.comunidadFicha.postsFilterHidden")}</option>
        </select>
      </div>

      {posts.isError ? (
        <ErrorState
          title={t("plataforma.comunidadFicha.postsLoadError")}
          description={errorKindText(posts.error, PLATFORM_COMMUNITIES_ERROR_KEYS, t, FALLBACK_KEY)}
        />
      ) : !posts.data ? (
        <p className="text-sm text-text-secondary">{t("common.loading")}</p>
      ) : posts.data.results.length === 0 ? (
        <EmptyState title={t("plataforma.comunidadFicha.postsEmpty")} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t("plataforma.comunidadFicha.postsTableCaption")}</caption>
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th scope="col" className="px-3 py-1.5 font-semibold">
                    {t("plataforma.comunidadFicha.postAuthorHeader")}
                  </th>
                  <th scope="col" className="px-3 py-1.5 font-semibold">
                    {t("plataforma.comunidadFicha.postContentHeader")}
                  </th>
                  <th scope="col" className="px-3 py-1.5 font-semibold">
                    {t("plataforma.comunidadFicha.postDateHeader")}
                  </th>
                  <th scope="col" className="px-3 py-1.5 font-semibold">
                    {t("plataforma.comunidadFicha.postStateHeader")}
                  </th>
                  <th scope="col" className="px-3 py-1.5 font-semibold">
                    <span className="sr-only">{t("plataforma.comunidadFicha.postActionsHeader")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {posts.data.results.map((post) => (
                  <PostRow key={post.id} post={post} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              disabled={!posts.data.previous}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              {t("plataforma.usuarios.previous")}
            </Button>
            <span className="text-sm text-text-secondary">
              {t("plataforma.comunidadFicha.postsCount", { count: posts.data.count })}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={!posts.data.next}
              onClick={() => setPage((prev) => prev + 1)}
            >
              {t("plataforma.usuarios.next")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function postExcerpt(post: PlatformCommunityPost, t: (key: string) => string): string {
  const text = post.content.trim();
  if (text) return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH)}…` : text;
  if (post.video_url) return t("plataforma.comunidadFicha.postVideoOnly");
  if (post.image || post.images.length > 0) return t("plataforma.comunidadFicha.postImageOnly");
  return t("plataforma.comunidadFicha.postEmptyContent");
}

function PostRow({ post }: { post: PlatformCommunityPost }) {
  const t = useTranslations();
  const setActive = useSetCommunityPostActive();
  const remove = useDeleteCommunityPost();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <tr className="border-b border-border-light align-top">
      <td className="px-3 py-1.5 text-text-base">{post.author_name}</td>
      <td className="px-3 py-1.5 text-text-base">
        <p>{postExcerpt(post, t)}</p>
        <p className="text-xs text-text-secondary">
          {t("plataforma.comunidadFicha.postStats", { likes: post.likes_count, comments: post.comments_count })}
        </p>
      </td>
      <td className="px-3 py-1.5 text-text-base">{formatAccountDate(post.created_at)}</td>
      <td className="px-3 py-1.5 text-text-base">
        <Badge tone={post.is_active ? "success" : "neutral"}>
          {post.is_active ? t("plataforma.comunidadFicha.postVisible") : t("plataforma.comunidadFicha.postHidden")}
        </Badge>
      </td>
      <td className="px-3 py-1.5 text-text-base">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={setActive.isPending}
            onClick={() => setActive.mutate({ postId: post.id, isActive: !post.is_active })}
          >
            {post.is_active ? t("plataforma.comunidadFicha.hidePost") : t("plataforma.comunidadFicha.showPost")}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              remove.reset();
              setConfirmingDelete(true);
            }}
          >
            {t("plataforma.comunidadFicha.deletePost")}
          </Button>
        </div>
        {setActive.isError ? (
          <p role="alert" className="mt-1 text-xs text-error">
            {errorKindText(setActive.error, PLATFORM_COMMUNITIES_ERROR_KEYS, t, FALLBACK_KEY)}
          </p>
        ) : null}
        <ConfirmDialog
          open={confirmingDelete}
          title={t("plataforma.comunidadFicha.deletePostTitle")}
          description={
            <>
              <span>{t("plataforma.comunidadFicha.deletePostDescription", { author: post.author_name })}</span>
              {remove.isError ? (
                <span role="alert" className="mt-2 block text-error">
                  {errorKindText(remove.error, PLATFORM_COMMUNITIES_ERROR_KEYS, t, FALLBACK_KEY)}
                </span>
              ) : null}
            </>
          }
          confirmLabel={t("plataforma.comunidadFicha.deletePost")}
          pending={remove.isPending}
          onCancel={() => {
            remove.reset();
            setConfirmingDelete(false);
          }}
          onConfirm={() => remove.mutate(post.id, { onSuccess: () => setConfirmingDelete(false) })}
        />
      </td>
    </tr>
  );
}
