import Link from "next/link";

/**
 * Pie común (tarea W1, Fase 6): un único enlace a la declaración de
 * accesibilidad pública (`/accesibilidad`), presente en los tres
 * layouts de área (`entidad`, `paraguas`, `plataforma`) y en el login,
 * que es donde el RD 1112/2018 exige que sea localizable.
 */
export function Footer() {
  return (
    <footer className="border-t border-border bg-white px-6 py-4 text-sm text-text-secondary">
      <Link href="/accesibilidad" className="font-medium text-primary-700 underline">
        Accesibilidad
      </Link>
    </footer>
  );
}
