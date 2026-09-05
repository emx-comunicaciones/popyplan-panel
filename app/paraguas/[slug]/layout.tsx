import Image from "next/image";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/LogoutButton";
import { ErrorState } from "@/components/ui/ErrorState";
import { ORGANIZATIONS } from "@/lib/api/endpoints";
import { serverFetch } from "@/lib/api/serverFetch";
import type { Organization } from "@/lib/api/types";
import { isEntidadPanelRole } from "@/lib/auth/area";
import { getServerSession } from "@/lib/auth/session";

export default async function ParaguasLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  if (session.platformRole.role) {
    redirect("/plataforma");
  }

  const membership = session.me.org_memberships.find(
    (m) => m.organization_slug === slug && isEntidadPanelRole(m.role),
  );
  if (!membership) {
    redirect("/");
  }

  const orgResult = await serverFetch<Organization>(
    ORGANIZATIONS.DETAIL(membership.organization_id),
    session.token,
  );
  const org = orgResult.ok ? orgResult.data : null;
  const headerColor = org?.primary_color || "var(--color-primary)";

  return (
    <div className="min-h-screen bg-border-light">
      <header
        className="flex items-center justify-between gap-4 px-6 py-4 text-text-inverse"
        style={{ backgroundColor: headerColor }}
      >
        <div className="flex items-center gap-3">
          {org?.logo ? (
            <Image
              src={org.logo}
              alt=""
              width={36}
              height={36}
              className="rounded-full bg-white object-contain"
            />
          ) : null}
          <span className="text-lg font-semibold">{org?.name ?? membership.organization_name}</span>
        </div>
        <LogoutButton />
      </header>
      {!orgResult.ok ? (
        <div className="p-4">
          <ErrorState title="No se pudo cargar la ficha de la entidad paraguas" />
        </div>
      ) : null}
      <main className="p-6">{children}</main>
    </div>
  );
}
