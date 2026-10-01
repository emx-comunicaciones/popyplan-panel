"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { PickerOption } from "@/components/ui/SearchPicker";
import { useCreateOpportunity, useCrmCatalog, useCrmUsers } from "@/hooks/useCrm";
import type { CrmOpportunity } from "@/lib/api/crmTypes";
import { errorKindText } from "@/lib/i18n/errorKindText";

import { CrmAccountPicker, crmInputClass, crmLabelClass } from "../common";
import { CRM_ERROR_KEYS } from "../QuickActivityDialog";

export function NewOpportunityDialog({
  isManager,
  onClose,
  onCreated,
}: {
  isManager: boolean;
  onClose: () => void;
  onCreated: (opportunity: CrmOpportunity) => void;
}) {
  const t = useTranslations();
  const titleId = useId();
  const create = useCreateOpportunity();
  const products = useCrmCatalog("product");
  const users = useCrmUsers();
  const [account, setAccount] = useState<PickerOption | null>(null);
  const [name, setName] = useState("");
  const [product, setProduct] = useState("");
  const [amount, setAmount] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [owner, setOwner] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!account || !name.trim()) return;
    create.mutate(
      {
        account: account.id,
        name: name.trim(),
        ...(product ? { product: Number(product) } : {}),
        ...(amount ? { estimated_amount: amount } : {}),
        ...(closeDate ? { expected_close_date: closeDate } : {}),
        ...(isManager && owner ? { owner: Number(owner) } : {}),
      },
      { onSuccess: onCreated },
    );
  }

  return (
    <Dialog open titleId={titleId} title={t("crm.opportunities.new.title")} onClose={onClose} pending={create.isPending}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <CrmAccountPicker id="crm-newopp-account" label={t("crm.opportunities.new.account")} value={account} onChange={setAccount} />
        <div>
          <label htmlFor="crm-newopp-name" className={crmLabelClass}>
            {t("crm.opportunities.new.name")}
          </label>
          <input id="crm-newopp-name" value={name} onChange={(e) => setName(e.target.value)} className={crmInputClass} required />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="crm-newopp-product" className={crmLabelClass}>
              {t("crm.opportunities.new.product")}
            </label>
            <select id="crm-newopp-product" value={product} onChange={(e) => setProduct(e.target.value)} className={crmInputClass}>
              <option value="">{t("crm.common.none")}</option>
              {products.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="crm-newopp-amount" className={crmLabelClass}>
              {t("crm.opportunities.new.amount")}
            </label>
            <input id="crm-newopp-amount" type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={crmInputClass} />
          </div>
          <div>
            <label htmlFor="crm-newopp-close" className={crmLabelClass}>
              {t("crm.opportunities.new.closeDate")}
            </label>
            <input id="crm-newopp-close" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} className={crmInputClass} />
          </div>
          {isManager ? (
            <div>
              <label htmlFor="crm-newopp-owner" className={crmLabelClass}>
                {t("crm.opportunities.new.owner")}
              </label>
              <select id="crm-newopp-owner" value={owner} onChange={(e) => setOwner(e.target.value)} className={crmInputClass}>
                <option value="">{t("crm.opportunities.new.ownerDefault")}</option>
                {users.data?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        {create.isError ? (
          <p role="alert" className="text-sm text-error">
            {errorKindText(create.error, CRM_ERROR_KEYS, t, "errors.crm.desconocido")}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={create.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={!account || !name.trim() || create.isPending}>
            {create.isPending ? t("crm.common.saving") : t("crm.opportunities.new.submit")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
