import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { resolveArea } from "@/lib/auth/area";
import { getServerSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.elegirEntidad");
  return { title: t("title") };
}

export default async function ElegirEntidadPage() {
  const t = await getTranslations("pages.elegirEntidad");
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
      <h1 className="text-xl font-semibold text-text-base">{t("title")}</h1>
      <p className="text-sm text-text-secondary">{t("description")}</p>
      <ul className="flex flex-col gap-2">
        {area.orgs.map((org) => (
          <li key={org.slug}>
            <Link
              href={`/entidad/${org.slug}`}
              className="block rounded-md border border-border px-3 py-2 text-sm font-medium text-text-form hover:bg-border-light"
            >
              {org.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
