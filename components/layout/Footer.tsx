"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * Pie común (tarea W1, Fase 6): un único enlace a la declaración de
 * accesibilidad pública (`/accesibilidad`), presente en los tres
 * layouts de área (`entidad`, `paraguas`, `plataforma`) y en el login,
 * que es donde el RD 1112/2018 exige que sea localizable.
 *
 * Componente de cliente (tarea i18n 2), igual criterio que `SkipLink`:
 * se monta tanto dentro de los layouts de área (Server Components) como
 * de `LoginForm.tsx` (cliente).
 */
export function Footer() {
  const t = useTranslations("layout.footer");

  return (
    <footer className="border-t border-border bg-white px-4 py-2 text-xs text-text-secondary">
      <Link href="/accesibilidad" className="font-medium text-primary-700 underline">
        {t("accessibility")}
      </Link>
    </footer>
  );
}
