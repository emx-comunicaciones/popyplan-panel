"use client";

/**
 * Pestaña «Datos»: edición de la entidad, relaciones con otras entidades,
 * histórico de responsables y baja (solo dirección comercial).
 */
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { PickerOption } from "@/components/ui/SearchPicker";
import {
  useCreateRelation,
  useCrmOwnerHistory,
  useCrmRelations,
  useDeleteAccount,
  useDeleteRelation,
  useUpdateAccount,
} from "@/hooks/useCrm";
import type { CrmAccountDetail, CrmAccountRelation } from "@/lib/api/crmTypes";
import { formatDateTime } from "@/lib/crm/format";
import { CRM_RELATION_KINDS, CRM_RELATION_KIND_LABELS, crmLabel } from "@/lib/crm/labels";
import { CRM_BASE, crmAccountHref } from "@/lib/crm/nav";

import { CrmAccountPicker, crmInputClass, crmLabelClass } from "../../common";
import { AccountFields, draftFromAccount, draftToWrite, type AccountDraft } from "../AccountFields";
import { MutationError, QueryBoundary } from "../shared";
import Link from "next/link";

function EditForm({ account, isManager }: { account: CrmAccountDetail; isManager: boolean }) {
  const t = useTranslations("crm.accountDetail.data");
  const tc = useTranslations();
  const update = useUpdateAccount();
  const [draft, setDraft] = useState<AccountDraft>(() => draftFromAccount(account));
  const [saved, setSaved] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    update.mutate({ id: account.id, ...draftToWrite(draft, { isManager, edit: true }) }, { onSuccess: () => setSaved(true) });
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <AccountFields
        idPrefix="crm-edit-account"
        draft={draft}
        onChange={(value) => {
          setSaved(false);
          setDraft(value);
        }}
        isManager={isManager}
        edit
      />
      <MutationError error={update.error} />
      {saved ? (
        <p role="status" className="text-sm text-success">
          {t("saved")}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={!draft.name.trim() || update.isPending}>
          {update.isPending ? tc("crm.common.saving") : tc("crm.common.save")}
        </Button>
      </div>
    </form>
  );
}

function RelationsCard({ account }: { account: CrmAccountDetail }) {
  const t = useTranslations("crm.accountDetail.data.relations");
  const root = useTranslations();
  const query = useCrmRelations(account.id);
  const create = useCreateRelation();
  const del = useDeleteRelation();
  const [target, setTarget] = useState<PickerOption | null>(null);
  const [kind, setKind] = useState("partner");
  const [removing, setRemoving] = useState<CrmAccountRelation | null>(null);
  return (
    <Card title={t("title")}>
      <QueryBoundary query={query}>
        {(relations) => (
          <div className="flex flex-col gap-3">
            {relations.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {relations.map((relation) => {
                  const outgoing = relation.source === account.id;
                  const otherId = outgoing ? relation.target : relation.source;
                  const otherName = outgoing ? relation.target_name : relation.source_name;
                  return (
                    <li key={relation.id} className="flex flex-wrap items-center gap-2">
                      <span className="text-text-secondary">
                        {outgoing ? crmLabel(CRM_RELATION_KIND_LABELS, relation.kind, root) : t("incoming", { kind: crmLabel(CRM_RELATION_KIND_LABELS, relation.kind, root) })}
                      </span>
                      <Link href={crmAccountHref(otherId)} className="font-medium text-primary-700 underline">
                        {otherName}
                      </Link>
                      <Button
                        type="button"
                        variant="secondary"
                        className="ml-auto"
                        aria-label={t("removeLabel", { name: otherName })}
                        onClick={() => {
                          del.reset();
                          setRemoving(relation);
                        }}
                      >
                        {t("remove")}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-text-secondary">{t("empty")}</p>
            )}
            <form
              className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                if (!target) return;
                create.mutate({ account: account.id, target: target.id, kind }, { onSuccess: () => setTarget(null) });
              }}
            >
              <CrmAccountPicker id="crm-relation-target" label={t("target")} value={target} onChange={setTarget} />
              <div>
                <label htmlFor="crm-relation-kind" className={crmLabelClass}>
                  {t("kind")}
                </label>
                <select id="crm-relation-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={crmInputClass}>
                  {CRM_RELATION_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {root(CRM_RELATION_KIND_LABELS[k])}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={!target || create.isPending}>
                {t("add")}
              </Button>
            </form>
            <MutationError error={create.error} />
          </div>
        )}
      </QueryBoundary>
      <ConfirmDialog
        open={!!removing}
        title={t("removeTitle")}
        description={
          <>
            <p>{t("removeDescription", { name: removing ? (removing.source === account.id ? removing.target_name : removing.source_name) : "" })}</p>
            <MutationError error={del.error} />
          </>
        }
        confirmLabel={t("remove")}
        pending={del.isPending}
        onCancel={() => {
          del.reset();
          setRemoving(null);
        }}
        onConfirm={() => removing && del.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
      />
    </Card>
  );
}

function OwnerHistoryCard({ accountId }: { accountId: number }) {
  const t = useTranslations("crm.accountDetail.data.owners");
  const query = useCrmOwnerHistory(accountId);
  return (
    <Card title={t("title")}>
      <QueryBoundary query={query}>
        {(changes) =>
          changes.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {changes.map((change, index) => (
                <li key={index}>
                  {t("change", { from: change.from || t("nobody"), to: change.to || t("nobody"), by: change.by || "—", date: formatDateTime(change.at) })}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-secondary">{t("empty")}</p>
          )
        }
      </QueryBoundary>
    </Card>
  );
}

function DeleteCard({ account }: { account: CrmAccountDetail }) {
  const t = useTranslations("crm.accountDetail.data.delete");
  const router = useRouter();
  const del = useDeleteAccount();
  const [confirming, setConfirming] = useState(false);
  return (
    <Card title={t("title")}>
      <p className="mb-2 text-sm text-text-secondary">{t("description")}</p>
      <Button
        type="button"
        variant="danger"
        onClick={() => {
          del.reset();
          setConfirming(true);
        }}
      >
        {t("button")}
      </Button>
      <ConfirmDialog
        open={confirming}
        title={t("confirmTitle")}
        description={
          <>
            <p>{t("confirmDescription", { name: account.name })}</p>
            <MutationError error={del.error} />
          </>
        }
        confirmLabel={t("button")}
        pending={del.isPending}
        onCancel={() => {
          del.reset();
          setConfirming(false);
        }}
        onConfirm={() => del.mutate(account.id, { onSuccess: () => router.push(`${CRM_BASE}/entidades`) })}
      />
    </Card>
  );
}

export function DataSection({ account, isManager }: { account: CrmAccountDetail; isManager: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <EditForm key={account.updated_at} account={account} isManager={isManager} />
      </Card>
      <RelationsCard account={account} />
      <OwnerHistoryCard accountId={account.id} />
      {isManager ? <DeleteCard account={account} /> : null}
    </div>
  );
}
