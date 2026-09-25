import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { UsuarioDetail } from "@/components/plataforma/UsuarioDetail";
import { EmptyState } from "@/components/ui/EmptyState";
import { isPlatformRole, plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.plataforma.usuarioFicha");
  return { title: t("title") };
}

/** `User.id` es un entero: cualquier otra cosa en la ruta es un 404 sin pedir nada (mismo criterio que la ficha de entidad, B8). */
const NUMERIC_ID = /^\d+$/;

export default async function PlataformaUsuarioDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ email?: string | string[] }>;
}) {
  const { id } = await params;
  if (!NUMERIC_ID.test(id)) {
    notFound();
  }

  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (!isPlatformRole(session.platformRole.role)) {
    redirect("/");
  }

  const t = await getTranslations();

  if (!plataformaMenuFor(session.platformRole.role).includes("usuarios")) {
    return (
      <EmptyState title={t("common.noAccess")} description={t("plataforma.usuarios.noAccessDescription")} />
    );
  }

  const rawEmail = (await searchParams)?.email;
  const email = typeof rawEmail === "string" && rawEmail.trim() ? rawEmail.trim() : null;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/plataforma/usuarios" className="text-sm text-primary-700 underline">
        {t("plataforma.usuarioFicha.backToList")}
      </Link>
      <h1 className="text-xl font-semibold text-text-base">{t("plataforma.usuarioFicha.heading")}</h1>
      <UsuarioDetail userId={id} email={email} isSelf={String(session.me.id) === id} />
    </div>
  );
}
