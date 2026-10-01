"use client";

/** Etiquetas (punto 30): se listan y se crean; las cuentas las usan por nombre. */
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCreateTag, useCrmTags } from "@/hooks/useCrm";

import { crmInputClass, crmLabelClass } from "../common";
import { useCrmErrorText } from "../work/shared";

export function TagsSection() {
  const t = useTranslations();
  const errorText = useCrmErrorText();
  const tags = useCrmTags();
  const create = useCreateTag();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#1fb3ae");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate({ name: trimmed, color }, { onSuccess: () => setName("") });
  }

  return (
    <section aria-labelledby="crm-settings-tags" className="flex flex-col gap-2">
      <h2 id="crm-settings-tags" className="text-lg font-semibold text-text-base">
        {t("crm.settings.tags.title")}
      </h2>
      <p className="text-sm text-text-secondary">{t("crm.settings.tags.hint")}</p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-border-light p-2">
        <div className="min-w-48 flex-1">
          <label htmlFor="crm-tag-name" className={crmLabelClass}>
            {t("crm.settings.tags.name")}
          </label>
          <input id="crm-tag-name" value={name} onChange={(e) => setName(e.target.value)} className={crmInputClass} />
        </div>
        <div>
          <label htmlFor="crm-tag-color" className={crmLabelClass}>
            {t("crm.settings.tags.color")}
          </label>
          <input
            id="crm-tag-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-12 rounded border border-border bg-white"
          />
        </div>
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          {t("crm.settings.tags.add")}
        </Button>
      </form>
      {create.isError ? (
        <p role="alert" className="text-sm text-error">
          {errorText(create.error)}
        </p>
      ) : null}
      {tags.isLoading ? (
        <p role="status" className="text-sm text-text-secondary">
          {t("crm.common.loading")}
        </p>
      ) : tags.isError ? (
        <ErrorState title={t("crm.settings.loadError")} description={errorText(tags.error)} />
      ) : (tags.data ?? []).length === 0 ? (
        <p className="text-sm text-text-secondary">{t("crm.settings.tags.empty")}</p>
      ) : (
        <ul aria-label={t("crm.settings.tags.listLabel")} className="flex flex-wrap gap-1.5">
          {tags.data?.map((tag) => (
            <li
              key={tag.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2 py-0.5 text-xs font-medium text-text-base"
            >
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: tag.color || "#9aa5b1" }}
              />
              {tag.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
