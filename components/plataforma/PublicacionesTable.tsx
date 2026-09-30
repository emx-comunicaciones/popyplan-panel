"use client";

/**
 * Publicaciones vistas por la plataforma (`GET /api/community-posts/`):
 * ocultar/mostrar (reversible, sin confirmación) y borrar (con
 * confirmación). La usan dos pantallas:
 *
 * - La ficha de una comunidad (`communityId`): `?community=`, sin
 *   columna «Dónde» ni filtro de sitio. Sigue igual que siempre.
 * - La sección «Publicaciones» (sin `communityId`): listado global con
 *   filtro de sitio (`?audience=`: abierto, comunidad o actividad) y la
 *   columna «Dónde» (`where`). CONTRATO «Publicar donde quieras».
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  useDeleteCommunityPost,
  usePlatformCommunityPosts,
  useSetCommunityPostActive,
} from "@/hooks/usePlatformCommunities";
import type { PlatformCommunityPost, PostAudience } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

import { PLATFORM_COMMUNITIES_ERROR_KEYS } from "./ComunidadesPlataformaTable";
import { formatAccountDate } from "./UsuariosTable";

const FALLBACK_KEY = "errors.platformCommunities.desconocido";
const EXCERPT_LENGTH = 140;

type PostFilter = "" | "true" | "false";
type AudienceFilter = "" | PostAudience;

const AUDIENCE_LABEL_KEYS: Record<PostAudience, string> = {
  open: "plataforma.publicaciones.audienceOpen",
  community: "plataforma.publicaciones.audienceCommunity",
  activity: "plataforma.publicaciones.audienceActivity",
};

export function PublicacionesTable({ communityId }: { communityId?: string }) {
  const t = useTranslations();
  const global = communityId === undefined;
  const [filter, setFilter] = useState<PostFilter>("");
  const [audience, setAudience] = useState<AudienceFilter>("");
  const [page, setPage] = useState(1);
  const posts = usePlatformCommunityPosts(communityId, {
    isActive: filter === "" ? undefined : filter === "true",
    audience: global && audience !== "" ? audience : undefined,
    page,
  });

  useEffect(() => {
    if (posts.error?.kind === "pagina_inexistente" && page > 1) setPage(1);
  }, [posts.error, page]);

  const headerCell = "px-3 py-1.5 font-semibold";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4">
        {global ? (
          <div>
            <label htmlFor="posts-audience" className="mb-1 block text-sm font-medium text-text-form">
              {t("plataforma.publicaciones.audienceFilterLabel")}
            </label>
            <select
              id="posts-audience"
              value={audience}
              onChange={(event) => {
                setAudience(event.target.value as AudienceFilter);
                setPage(1);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
            >
              <option value="">{t("plataforma.publicaciones.audienceAll")}</option>
              <option value="open">{t(AUDIENCE_LABEL_KEYS.open)}</option>
              <option value="community">{t(AUDIENCE_LABEL_KEYS.community)}</option>
              <option value="activity">{t(AUDIENCE_LABEL_KEYS.activity)}</option>
            </select>
          </div>
        ) : null}
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
              <caption className="sr-only">
                {global
                  ? t("plataforma.publicaciones.tableCaption")
                  : t("plataforma.comunidadFicha.postsTableCaption")}
              </caption>
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th scope="col" className={headerCell}>
                    {t("plataforma.comunidadFicha.postAuthorHeader")}
                  </th>
                  <th scope="col" className={headerCell}>
                    {t("plataforma.comunidadFicha.postContentHeader")}
                  </th>
                  {global ? (
                    <th scope="col" className={headerCell}>
                      {t("plataforma.publicaciones.whereHeader")}
                    </th>
                  ) : null}
                  <th scope="col" className={headerCell}>
                    {t("plataforma.comunidadFicha.postDateHeader")}
                  </th>
                  <th scope="col" className={headerCell}>
                    {t("plataforma.comunidadFicha.postStateHeader")}
                  </th>
                  <th scope="col" className={headerCell}>
                    <span className="sr-only">{t("plataforma.comunidadFicha.postActionsHeader")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {posts.data.results.map((post) => (
                  <PostRow key={post.id} post={post} showWhere={global} />
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

/**
 * Texto de «Dónde»: el sitio y, si lo hay, su nombre. En abierto
 * `where` es `null` y no se nombra nada (regla dura 2 del contrato).
 * Sin `audience` (backend antiguo) se cae a `community`.
 */
function WhereCell({ post }: { post: PlatformCommunityPost }) {
  const t = useTranslations();
  const audience: PostAudience = post.audience ?? "community";
  const where = post.where ?? null;
  return (
    <>
      <p>{t(AUDIENCE_LABEL_KEYS[audience])}</p>
      {where ? (
        <p className="text-xs text-text-secondary">
          {where.type === "community" ? where.name : where.title}
          {where.type === "activity" && where.starts_at ? ` · ${formatAccountDate(where.starts_at)}` : ""}
        </p>
      ) : null}
    </>
  );
}

function PostRow({ post, showWhere }: { post: PlatformCommunityPost; showWhere: boolean }) {
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
      {showWhere ? (
        <td className="px-3 py-1.5 text-text-base">
          <WhereCell post={post} />
        </td>
      ) : null}
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
