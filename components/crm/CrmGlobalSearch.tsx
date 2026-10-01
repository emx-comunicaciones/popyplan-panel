"use client";

/**
 * Búsqueda global del CRM (punto 44): entidades, municipios, contactos,
 * teléfonos, emails, oportunidades, nº de expediente y documentos, a la vez.
 */
import Link from "next/link";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCrmSearch } from "@/hooks/useCrm";
import { crmAccountHref, crmOpportunityHref } from "@/lib/crm/nav";

export function CrmGlobalSearch() {
  const t = useTranslations("crm.search");
  const id = useId();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const search = useCrmSearch(debounced);
  const open = debounced.trim().length >= 2;
  const data = search.data;
  const empty =
    data &&
    !data.accounts.length &&
    !data.contacts.length &&
    !data.opportunities.length &&
    !data.documents.length;

  return (
    <div className="relative w-full max-w-md">
      <label htmlFor={id} className="sr-only">
        {t("label")}
      </label>
      <input
        id={id}
        type="search"
        role="combobox"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("placeholder")}
        className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm"
        aria-controls={open ? `${id}-results` : undefined}
        aria-expanded={open}
      />
      {open ? (
        <div
          id={`${id}-results`}
          className="absolute left-0 right-0 z-30 mt-1 max-h-96 overflow-y-auto rounded-md border border-border bg-white p-2 shadow-lg"
        >
          {search.isLoading ? <p className="text-sm text-text-secondary">{t("loading")}</p> : null}
          {search.isError ? (
            <p role="alert" className="text-sm text-error">
              {t("error")}
            </p>
          ) : null}
          {empty ? <p className="text-sm text-text-secondary">{t("empty")}</p> : null}
          {data?.accounts.length ? (
            <Group title={t("accounts")}>
              {data.accounts.map((a) => (
                <ResultLink key={`a${a.id}`} href={crmAccountHref(a.id)} onPick={() => setQuery("")}
                  main={a.name} sub={a.municipality ?? ""} />
              ))}
            </Group>
          ) : null}
          {data?.contacts.length ? (
            <Group title={t("contacts")}>
              {data.contacts.map((c) => (
                <ResultLink key={`c${c.id}`} href={crmAccountHref(c.account)} onPick={() => setQuery("")}
                  main={c.name} sub={[c.position, c.account_name, c.phone || c.email].filter(Boolean).join(" · ")} />
              ))}
            </Group>
          ) : null}
          {data?.opportunities.length ? (
            <Group title={t("opportunities")}>
              {data.opportunities.map((o) => (
                <ResultLink key={`o${o.id}`} href={crmOpportunityHref(o.id)} onPick={() => setQuery("")}
                  main={o.name} sub={[o.account_name, o.file_number].filter(Boolean).join(" · ")} />
              ))}
            </Group>
          ) : null}
          {data?.documents.length ? (
            <Group title={t("documents")}>
              {data.documents.map((d) => (
                <ResultLink key={`d${d.id}`} href={d.account ? crmAccountHref(d.account) : "#"} onPick={() => setQuery("")}
                  main={d.name} sub={d.account_name} />
              ))}
            </Group>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="px-1 text-xs font-semibold uppercase text-text-secondary">{title}</p>
      <ul>{children}</ul>
    </div>
  );
}

function ResultLink({ href, main, sub, onPick }: { href: string; main: string; sub: string; onPick: () => void }) {
  return (
    <li>
      <Link href={href} onClick={onPick} className="block rounded px-1 py-1 text-sm hover:bg-border-light">
        <span className="font-medium text-text-base">{main}</span>
        {sub ? <span className="ml-2 text-xs text-text-secondary">{sub}</span> : null}
      </Link>
    </li>
  );
}
