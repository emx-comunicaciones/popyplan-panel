"use client";

/**
 * Menú de cuenta de la cabecera (2026-09-20, encargo del propietario:
 * «pon estos botones bajo un icono de login típico, que se vea el idioma,
 * cerrar sesión y el correo electrónico»). Un botón redondo de 32 px con
 * el icono de persona abre un panel anclado a la derecha con el nombre
 * (si lo hay) y el email de la cuenta, el selector de idioma
 * (`LanguageSwitcher` con su etiqueta visible) y «Cerrar sesión». El
 * botón «?» de `PageHelp` se queda fuera, a la izquierda: es ayuda de la
 * pantalla, no de la cuenta.
 *
 * No es un `role="menu"` ARIA: dentro hay un `<select>` y un botón, no
 * una lista de `menuitem`, así que el panel es un `role="group"` con
 * nombre («Cuenta») y el botón lleva `aria-haspopup="true"` +
 * `aria-expanded` + `aria-controls`. Al abrir, el foco pasa al primer
 * control del panel; `Escape` cierra y devuelve el foco al botón; un clic
 * fuera cierra; cambiar de pantalla (`usePathname`) cierra, igual que
 * `PageHelp`. Fondo blanco propio, como el resto de controles de la
 * cabecera (viven sobre el color de marca de la entidad).
 */
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { LogoutButton } from "@/components/LogoutButton";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

export interface UserMenuProps {
  email: string;
  /** Nombre a mostrar sobre el email; `null`/vacío → solo el email. */
  name?: string | null;
}

export function UserMenu({ email, name }: UserMenuProps) {
  const t = useTranslations("account");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const panel = rootRef.current?.querySelector<HTMLElement>(
      `[id="${panelId}"]`,
    );
    panel
      ?.querySelector<HTMLElement>("select, button, a[href], input")
      ?.focus();

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, panelId]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={t("open", { email })}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white text-primary-700 hover:bg-primary-100 focus-visible:outline-primary-700"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="currentColor"
        >
          <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.5-8 5.5V21h16v-1.5c0-3-3.6-5.5-8-5.5Z" />
        </svg>
      </button>
      {open ? (
        <div
          id={panelId}
          role="group"
          aria-label={t("title")}
          className="absolute right-0 top-full z-20 mt-2 w-64 rounded-md border border-border bg-white p-3 text-text-base shadow-sm"
        >
          {name ? (
            <p className="truncate text-sm font-semibold">{name}</p>
          ) : null}
          <p className="truncate text-xs text-text-secondary" title={email}>
            {email}
          </p>
          <div className="my-3 border-t border-border" />
          <LanguageSwitcher labelVisible />
          <div className="my-3 border-t border-border" />
          <LogoutButton className="w-full" />
        </div>
      ) : null}
    </div>
  );
}
