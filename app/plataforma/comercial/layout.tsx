import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { CrmShell } from "@/components/crm/CrmShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { isCrmManager, isCrmRole, isPlatformRole } from "@/lib/auth/plataformaMenu";
import { getServerSession } from "@/lib/auth/session";
import { CRM_SECTION_LABELS, crmSectionHref, crmSectionsFor } from "@/lib/crm/nav";

/**
 * Pestaña «Comercial» (CRM, `docs/CRM.md` del backend): su propio menú de
 * secciones dentro de la pestaña, encima del contenido, y el botón
 * permanente «+ Registrar actividad» (punto 36 de la spec). Solo
 * `superadmin`, `sales_lead` y `sales`; el resto de roles de plataforma
 * ve «sin acceso» (el backend les responde 403 igualmente).
 */
export default async function ComercialLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  const role = session.platformRole.role;
  if (!isPlatformRole(role)) {
    redirect("/");
  }
  const t = await getTranslations();
  if (!isCrmRole(role)) {
    return <EmptyState title={t("common.noAccess")} description={t("crm.shell.noAccess")} />;
  }
  const sections = crmSectionsFor(role).map((section) => ({
    href: crmSectionHref(section),
    label: t(CRM_SECTION_LABELS[section]),
  }));
  return (
    <CrmShell sections={sections} isManager={isCrmManager(role)} userId={session.me.id}>
      {children}
    </CrmShell>
  );
}
