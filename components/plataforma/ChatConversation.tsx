"use client";

/**
 * Una conversación vista por el soporte (admin de plataforma, bloque 3,
 * 2026-09-26): participantes (`ADMIN_CHATS.DETAIL`), mensajes del más
 * antiguo al más reciente (`ADMIN_CHATS.MESSAGES`, array plano) y un
 * formulario para responder. El aviso de arriba se pinta siempre: el
 * mensaje sale con la cuenta **real** de quien responde (no como
 * «Popyplan»), no llega en directo a las pantallas abiertas y **el
 * backend no audita ni la lectura ni el envío**. Nunca datos de contacto:
 * solo alias públicos.
 */
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  useAdminChat,
  useAdminChatMessages,
  useSendAdminChatMessage,
  type AdminChatsErrorKind,
} from "@/hooks/useAdminChats";
import { errorKindText } from "@/lib/i18n/errorKindText";
import { activeLanguage, localeFor } from "@/lib/i18n/locale";

import { ADMIN_CHATS_ERROR_KEYS, CHAT_TYPE_KEYS, roomLabel } from "./ChatsTable";

const SEND_ERROR_KEYS: Record<AdminChatsErrorKind, string> = {
  invalido: "errors.adminChats.sendInvalido",
  sin_acceso: "errors.adminChats.sinAcceso",
  no_encontrado: "errors.adminChats.noEncontrado",
  desconocido: "errors.adminChats.sendDesconocido",
};

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleString(localeFor(activeLanguage()), { dateStyle: "short", timeStyle: "short" });
}

export function ChatConversation({ roomId }: { roomId: string }) {
  const t = useTranslations();
  const room = useAdminChat(roomId);
  const messages = useAdminChatMessages(roomId);
  const send = useSendAdminChatMessage(roomId);
  const [content, setContent] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    send.mutate(trimmed, { onSuccess: () => setContent("") });
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="note" className="rounded-md border border-border bg-category-light p-3 text-sm text-text-base">
        <p className="font-semibold">{t("plataforma.chatFicha.noticeTitle")}</p>
        <ul className="mt-1 list-disc pl-5">
          <li>{t("plataforma.chatFicha.noticeIdentity")}</li>
          <li>{t("plataforma.chatFicha.noticeDelivery")}</li>
          <li>{t("plataforma.chatFicha.noticeAudit")}</li>
        </ul>
      </div>

      <Card title={t("plataforma.chatFicha.participantsTitle")}>
        {room.isError ? (
          <ErrorState
            title={t("plataforma.chatFicha.roomLoadError")}
            description={errorKindText(room.error, ADMIN_CHATS_ERROR_KEYS, t, "errors.adminChats.desconocido")}
          />
        ) : !room.data ? (
          <p className="text-sm text-text-secondary">{t("common.loading")}</p>
        ) : (
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-medium text-text-base">
              {roomLabel(room.data)}
              {" · "}
              {CHAT_TYPE_KEYS[room.data.chat_type] ? t(CHAT_TYPE_KEYS[room.data.chat_type]) : room.data.chat_type}
            </p>
            {room.data.participants.length === 0 ? (
              <p className="text-text-secondary">{t("plataforma.chatFicha.noParticipants")}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {room.data.participants.map((person) => (
                  <li key={person.id} className="rounded-full bg-card-light px-2 py-0.5 text-xs text-text-base">
                    {person.public_name}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-text-secondary">{t("plataforma.chatFicha.blockedHint")}</p>
          </div>
        )}
      </Card>

      <Card title={t("plataforma.chatFicha.messagesTitle")}>
        {messages.isError ? (
          <ErrorState
            title={t("plataforma.chatFicha.messagesLoadError")}
            description={errorKindText(messages.error, ADMIN_CHATS_ERROR_KEYS, t, "errors.adminChats.desconocido")}
          />
        ) : !messages.data ? (
          <p className="text-sm text-text-secondary">{t("common.loading")}</p>
        ) : messages.data.length === 0 ? (
          <p className="text-sm text-text-secondary">{t("plataforma.chatFicha.noMessages")}</p>
        ) : (
          <ol className="flex flex-col gap-2" aria-label={t("plataforma.chatFicha.messagesTitle")}>
            {messages.data.map((message) => (
              <li key={message.id} className="rounded-md border border-border-light p-2 text-sm">
                <p className="text-xs text-text-secondary">
                  <span className="font-semibold text-text-base">
                    {message.sender?.public_name ?? t("plataforma.chatFicha.systemSender")}
                  </span>
                  {" · "}
                  <time dateTime={message.created_at}>{formatMessageTime(message.created_at)}</time>
                </p>
                {message.is_deleted ? (
                  <p className="italic text-text-secondary">{t("plataforma.chatFicha.deletedMessage")}</p>
                ) : (
                  <>
                    {message.content ? <p className="whitespace-pre-wrap text-text-base">{message.content}</p> : null}
                    {message.image ? (
                      <p className="text-text-secondary">{t("plataforma.chatFicha.imageMessage")}</p>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card title={t("plataforma.chatFicha.replyTitle")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <label htmlFor="chat-reply" className="text-sm font-medium text-text-form">
            {t("plataforma.chatFicha.replyLabel")}
          </label>
          <textarea
            id="chat-reply"
            rows={3}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-1.5 text-sm focus-visible:outline-primary-700"
          />
          <div>
            <Button type="submit" disabled={!content.trim() || send.isPending}>
              {t("plataforma.chatFicha.send")}
            </Button>
          </div>
          {send.isError ? (
            <p role="alert" className="text-sm text-error">
              {errorKindText(send.error, SEND_ERROR_KEYS, t, "errors.adminChats.sendDesconocido")}
            </p>
          ) : null}
          {send.isSuccess ? (
            <p role="status" className="text-sm text-success">
              {t("plataforma.chatFicha.sent")}
            </p>
          ) : null}
        </form>
      </Card>
    </div>
  );
}
