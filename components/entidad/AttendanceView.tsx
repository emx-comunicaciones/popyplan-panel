"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useAttendees } from "@/hooks/useAttendees";
import { useCheckin } from "@/hooks/useCheckin";
import { useMarkAttendance } from "@/hooks/useMarkAttendance";
import type { Attendee } from "@/lib/api/types";
import { errorKindText } from "@/lib/i18n/errorKindText";

export interface AttendanceViewProps {
  eventId: string;
  /**
   * Entidad a la que pertenece la actividad. No viaja en ninguna
   * petición de esta pantalla: la usan `useMarkAttendance`/`useCheckin`
   * para refrescar los listados de la entidad que dependen de la
   * asistencia (actividades y fichas de persona).
   */
  orgId: number | string;
}

const STATUS_KEYS: Record<string, string> = {
  registered: "entidad.attendanceStatus.registered",
  waitlisted: "entidad.attendanceStatus.waitlisted",
  cancelled: "entidad.attendanceStatus.cancelled",
  attended: "entidad.attendanceStatus.attended",
  no_show: "entidad.attendanceStatus.noShow",
};

const CHECKIN_ERROR_KEYS = {
  token_desconocido: "errors.checkin.tokenDesconocido",
  fuera_de_ventana: "errors.checkin.fueraDeVentana",
  sin_permiso: "errors.checkin.sinPermiso",
  desconocido: "errors.checkin.desconocido",
} as const;

const MARK_ATTENDANCE_ERROR_KEYS = {
  invalido: "errors.markAttendance.invalido",
  no_inscrita: "errors.markAttendance.noInscrita",
  sin_permiso: "errors.markAttendance.sinPermiso",
  desconocido: "errors.markAttendance.desconocido",
} as const;

const ATTENDEES_ERROR_KEYS = {
  sin_permiso: "errors.attendees.sinPermiso",
  desconocido: "errors.attendees.desconocido",
} as const;

/** `popyplan://checkin/<token>` (`qr_payload` de `GET .../my-checkin/`). */
function extractToken(scanned: string): string {
  const match = /checkin\/([^/?#]+)/.exec(scanned);
  return match ? match[1] : scanned;
}

function CheckinBox({ eventId, orgId }: { eventId: string; orgId: number | string }) {
  const checkin = useCheckin(eventId, orgId);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "already" | "error"; text: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const barcodeDetectorAvailable =
    typeof window !== "undefined" && "BarcodeDetector" in window;
  const t = useTranslations("entidad.asistencia");
  const tAll = useTranslations();

  function submitToken(value: string) {
    const parsed = extractToken(value.trim());
    if (!parsed) return;
    checkin.mutate(
      { token: parsed },
      {
        onSuccess: (data) => {
          setMessage(
            data.already
              ? { kind: "already", text: t("alreadyUsed") }
              : { kind: "ok", text: t("checkinOk") },
          );
          setToken("");
        },
        onError: (error) => {
          setMessage({
            kind: "error",
            text: errorKindText(error, CHECKIN_ERROR_KEYS, tAll, "errors.checkin.desconocido"),
          });
        },
      },
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitToken(token);
  }

  /**
   * Asigna el stream al `<video>` cuando ambos existen. El `<video>` solo
   * se monta con `scanning === true`, así que esto se llama desde
   * `startScanning` (tras resolver `getUserMedia`) y desde el effect de
   * `[scanning]` (tras el commit del `<video>`), cubriendo cualquier orden
   * de resolución. Si el escaneo se detuvo mientras se pedía la cámara,
   * suelta los tracks en vez de dejarlos vivos.
   */
  function attachStream() {
    const stream = streamRef.current;
    const video = videoRef.current;
    if (!stream) return;
    if (!video) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return;
    }
    video.srcObject = stream;
    video.play().catch(() => {
      // El usuario pudo parar el escaneo antes de que el play llegara.
    });
  }

  async function startScanning() {
    setMessage(null);
    setScanning(true);
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    } catch {
      streamRef.current = null;
      setScanning(false);
      setMessage({ kind: "error", text: t("cameraDenied") });
      return;
    }
    attachStream();
  }

  function stopScanning() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }

  /**
   * Asigna el stream al `<video>` recién montado y, sobre todo, suelta la
   * cámara al desmontar el componente (navegación cliente) o al dejar de
   * escanear: sin este cleanup los tracks de `getUserMedia` quedaban
   * activos para siempre aunque la página ya no existiera.
   */
  useEffect(() => {
    if (!scanning) return;
    const video = videoRef.current;
    attachStream();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (video) {
        video.srcObject = null;
      }
    };
  }, [scanning]);

  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DetectorCtor = (window as any).BarcodeDetector;
    const detector = new DetectorCtor({ formats: ["qr_code"] });

    async function tick() {
      if (cancelled || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length > 0) {
          const value = codes[0].rawValue as string;
          stopScanning();
          submitToken(value);
          return;
        }
      } catch {
        // Sigue intentando: un frame sin código legible no es un error.
      }
      if (!cancelled) requestAnimationFrame(tick);
    }

    tick();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  return (
    <Card title={t("checkinTitle")}>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="checkin-token" className="mb-1 block text-sm font-medium text-text-form">
            {t("tokenLabel")}
          </label>
          <input
            id="checkin-token"
            type="text"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <Button type="submit" disabled={checkin.isPending || !token}>
          {t("giveEntry")}
        </Button>
        {barcodeDetectorAvailable ? (
          scanning ? (
            <Button type="button" variant="secondary" onClick={stopScanning}>
              {t("stopScanning")}
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={startScanning}>
              {t("startScanning")}
            </Button>
          )
        ) : null}
      </form>
      {scanning ? (
        <video
          ref={videoRef}
          aria-label={t("cameraViewLabel")}
          muted
          className="mt-2 w-full max-w-xs"
        >
          <track kind="captions" />
        </video>
      ) : null}
      {message ? (
        <p role={message.kind === "error" ? "alert" : "status"} className="mt-2 text-sm">
          {message.text}
        </p>
      ) : null}
    </Card>
  );
}

function AttendeeRow({
  attendee,
  eventId,
  orgId,
}: {
  attendee: Attendee;
  eventId: string;
  orgId: number | string;
}) {
  const markAttendance = useMarkAttendance(eventId, orgId);
  const [rowMessage, setRowMessage] = useState<string | null>(null);
  const isPendingThisRow = markAttendance.isPending && markAttendance.variables?.userId === attendee.user.id;
  const t = useTranslations("entidad.asistencia");
  const tAll = useTranslations();

  function mark(attended: boolean) {
    setRowMessage(null);
    markAttendance.mutate(
      { userId: attendee.user.id, attended },
      {
        onError: (error) =>
          setRowMessage(
            errorKindText(error, MARK_ATTENDANCE_ERROR_KEYS, tAll, "errors.markAttendance.desconocido"),
          ),
      },
    );
  }

  return (
    <tr className="border-b border-border-light">
      <td className="px-3 py-2 text-text-base">{attendee.public_name}</td>
      <td className="px-3 py-2 text-text-base">
        <Badge>{STATUS_KEYS[attendee.status] ? tAll(STATUS_KEYS[attendee.status]) : attendee.status}</Badge>
      </td>
      <td className="px-3 py-2 text-text-base">{attendee.guests}</td>
      <td className="px-3 py-2 text-text-base">
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={isPendingThisRow} onClick={() => mark(true)}>
            {t("markAttended")}
          </Button>
          <Button type="button" variant="secondary" disabled={isPendingThisRow} onClick={() => mark(false)}>
            {t("markNotAttended")}
          </Button>
        </div>
        {rowMessage ? (
          <p role="alert" className="mt-1 text-xs text-error">
            {rowMessage}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

/**
 * Asistencia de una actividad (`docs/PANEL.md` §4): lista nominal de
 * asistentes con su estado, marcar asistencia manual
 * (`POST .../attendance/`, exige que la actividad ya haya empezado) y
 * check-in por QR (`POST .../checkin/`, ventana `-2h..+12h`, idempotente).
 */
export function AttendanceView({ eventId, orgId }: AttendanceViewProps) {
  const attendees = useAttendees(eventId);
  const t = useTranslations("entidad.asistencia");
  const tAll = useTranslations();

  return (
    <div className="flex flex-col gap-4">
      <CheckinBox eventId={eventId} orgId={orgId} />

      <section aria-labelledby="asistentes-heading">
        <h2 id="asistentes-heading" className="mb-2 text-lg font-semibold text-text-base">
          {t("attendeesHeading")}
        </h2>
        {attendees.isError ? (
          <ErrorState
            title={t("attendeesLoadErrorTitle")}
            description={errorKindText(
              attendees.error,
              ATTENDEES_ERROR_KEYS,
              tAll,
              "errors.attendees.desconocido",
            )}
          />
        ) : !attendees.data ? (
          <p className="text-sm text-text-secondary">{t("loadingAttendees")}</p>
        ) : attendees.data.length === 0 ? (
          <EmptyState title={t("noAttendees")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{t("attendeesTableCaption")}</caption>
              <thead>
                <tr className="border-b border-border text-text-secondary">
                  <th scope="col" className="px-3 py-2 font-semibold">{t("colPerson")}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{t("colStatus")}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{t("colGuests")}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{t("colMark")}</th>
                </tr>
              </thead>
              <tbody>
                {attendees.data.map((attendee) => (
                  <AttendeeRow
                    key={attendee.user.id}
                    attendee={attendee}
                    eventId={eventId}
                    orgId={orgId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
