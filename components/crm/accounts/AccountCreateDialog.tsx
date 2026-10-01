"use client";

/**
 * «Nueva entidad»: alta con aviso de duplicados mientras se escribe
 * (nombre, CIF y municipio) y, si el backend responde 409, la lista de lo
 * que ya existe con «Abrir existente» y «Crear igualmente» (`force`).
 */
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useCreateAccount, useCrmAccountDuplicates } from "@/hooks/useCrm";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { crmAccountHref } from "@/lib/crm/nav";

import { AccountFields, EMPTY_DRAFT, draftToWrite, type AccountDraft } from "./AccountFields";
import { DuplicatesList, MutationError } from "./shared";

export function AccountCreateDialog({ isManager, onClose }: { isManager: boolean; onClose: () => void }) {
  const t = useTranslations("crm.accounts");
  const tc = useTranslations("common");
  const titleId = useId();
  const router = useRouter();
  const create = useCreateAccount();
  const [draft, setDraft] = useState<AccountDraft>(EMPTY_DRAFT);
  const name = useDebouncedValue(draft.name, 300);
  const taxId = useDebouncedValue(draft.tax_id, 300);
  const live = useCrmAccountDuplicates({ name, tax_id: taxId, place: draft.place?.ine ?? null });
  const conflict = create.error?.kind === "duplicado" ? create.error : null;

  function submit(force: boolean) {
    create.mutate(
      { ...draftToWrite(draft, { isManager }), force },
      {
        onSuccess: (account) => {
          onClose();
          router.push(crmAccountHref(account.id));
        },
      },
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit(false);
  }

  return (
    <Dialog open titleId={titleId} title={t("create.title")} onClose={onClose} pending={create.isPending} widthClassName="max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <AccountFields idPrefix="crm-new-account" draft={draft} onChange={(value) => { create.reset(); setDraft(value); }} isManager={isManager} />
        {conflict ? (
          <>
            <DuplicatesList duplicates={conflict.duplicates ?? []} />
            <p role="alert" className="text-sm text-error">
              {conflict.detail ?? t("create.conflict")}
            </p>
          </>
        ) : (
          <>
            <DuplicatesList duplicates={live.data ?? []} live />
            <MutationError error={create.error} />
          </>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={create.isPending}>
            {tc("cancel")}
          </Button>
          {conflict ? (
            <Button type="button" variant="danger" onClick={() => submit(true)} disabled={create.isPending}>
              {t("create.force")}
            </Button>
          ) : (
            <Button type="submit" disabled={!draft.name.trim() || create.isPending}>
              {create.isPending ? t("create.saving") : t("create.submit")}
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
