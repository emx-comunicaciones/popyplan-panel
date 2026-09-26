import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { ChatConversation } from "@/components/plataforma/ChatConversation";
import { EmptyState } from "@/components/ui/EmptyState";
import { isPlatformRole, plataformaMenuFor } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.plataforma.chatFicha");
  return { title: t("title") };
}

/** `ChatRoom.id` es un UUID: otra cosa en la ruta es un 404 sin pedir nada. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PlataformaChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) {
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

  if (!plataformaMenuFor(session.platformRole.role).includes("chats")) {
    return <EmptyState title={t("common.noAccess")} description={t("plataforma.chats.noAccessDescription")} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/plataforma/chats" className="text-sm text-primary-700 underline">
        {t("plataforma.chatFicha.backToList")}
      </Link>
      <h1 className="text-xl font-semibold text-text-base">{t("plataforma.chatFicha.heading")}</h1>
      <ChatConversation roomId={id} />
    </div>
  );
}
