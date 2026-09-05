import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { resolveArea } from "@/lib/auth/area";
import { getServerSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Elige una entidad" };

export default async function ElegirEntidadPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  const area = resolveArea(session.me, session.platformRole);

  if (area === "plataforma") redirect("/plataforma");
  if (area === "sin-acceso") redirect("/");
  if (area.kind === "entidad") redirect(`/entidad/${area.slug}`);
  if (area.kind === "paraguas") redirect(`/paraguas/${area.slug}`);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-4">
      <h1 className="text-xl font-semibold text-text-base">Elige una entidad</h1>
      <p className="text-sm text-text-secondary">
        Tienes rol en varias entidades. Elige con cuál quieres entrar al panel.
      </p>
      <ul className="flex flex-col gap-2">
        {area.orgs.map((org) => (
          <li key={org.slug}>
            <Link
              href={`/entidad/${org.slug}`}
              className="block rounded-md border border-border px-4 py-3 text-sm font-medium text-text-form hover:bg-border-light"
            >
              {org.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
