"use client";

/**
 * Diálogos de alta de la ficha: tarea, contacto, oportunidad, documento,
 * nota y reunión (cita futura). Todos montan nuevos al abrirse (estado
 * limpio) y se cierran solo cuando la mutación termina bien.
 */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import {
  useCreateActivity,
  useCreateContact,
  useCreateNote,
  useCreateOpportunity,
  useCreateTask,
  useCrmAccountContacts,
  useCrmCatalog,
  useUpdateContact,
  useUploadDocument,
} from "@/hooks/useCrm";
import type { CrmActivityKind, CrmContact, CrmDocumentCategory, CrmTaskPriority } from "@/lib/api/crmTypes";
import { fromLocalInput, toLocalInput } from "@/lib/crm/format";
import {
  CRM_ACTIVITY_KINDS,
  CRM_ACTIVITY_KIND_LABELS,
  CRM_DOCUMENT_CATEGORIES,
  CRM_DOCUMENT_CATEGORY_LABELS,
  CRM_PRIORITIES,
  CRM_PRIORITY_LABELS,
} from "@/lib/crm/labels";
import { crmOpportunityHref } from "@/lib/crm/nav";

import { CrmUserSelect, crmInputClass, crmLabelClass } from "../../common";
import { DuplicatesList, FormDialog, contactFullName } from "../shared";

export interface DialogAccount {
  id: number;
}

function tomorrowAt(hour: number): string {
  const date = new Date(Date.now() + 86_400_000);
  date.setHours(hour, 0, 0, 0);
  return toLocalInput(date.toISOString());
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={crmLabelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Tarea ──────────────────────────────────────────────────────────────────

export function TaskDialog({ account, isManager, userId, onClose }: { account: DialogAccount; isManager: boolean; userId: number; onClose: () => void }) {
  const t = useTranslations();
  const create = useCreateTask();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("call");
  const [dueAt, setDueAt] = useState(() => tomorrowAt(10));
  const [priority, setPriority] = useState("normal");
  const [assignee, setAssignee] = useState<number | null>(userId || null);
  const [description, setDescription] = useState("");
  const due = fromLocalInput(dueAt);
  return (
    <FormDialog
      title={t("crm.accountDetail.task.title")}
      onClose={onClose}
      pending={create.isPending}
      error={create.error}
      canSubmit={!!title.trim() && !!due}
      submitLabel={t("crm.common.save")}
      onSubmit={() =>
        due &&
        create.mutate(
          {
            account: account.id,
            title: title.trim(),
            kind,
            due_at: due,
            priority: priority as CrmTaskPriority,
            assignee,
            description,
          } as never,
          { onSuccess: onClose },
        )
      }
    >
      <Field id="crm-task-title" label={t("crm.accountDetail.task.what")}>
        <input id="crm-task-title" value={title} onChange={(e) => setTitle(e.target.value)} className={crmInputClass} required />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id="crm-task-kind" label={t("crm.accountDetail.task.kind")}>
          <select id="crm-task-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={crmInputClass}>
            {CRM_ACTIVITY_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(CRM_ACTIVITY_KIND_LABELS[k])}
              </option>
            ))}
          </select>
        </Field>
        <Field id="crm-task-due" label={t("crm.accountDetail.task.dueAt")}>
          <input id="crm-task-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={crmInputClass} required />
        </Field>
        <Field id="crm-task-priority" label={t("crm.accountDetail.task.priority")}>
          <select id="crm-task-priority" value={priority} onChange={(e) => setPriority(e.target.value)} className={crmInputClass}>
            {CRM_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(CRM_PRIORITY_LABELS[p])}
              </option>
            ))}
          </select>
        </Field>
        {isManager ? (
          <CrmUserSelect id="crm-task-assignee" label={t("crm.accountDetail.task.assignee")} value={assignee} onChange={setAssignee} />
        ) : null}
      </div>
      <Field id="crm-task-description" label={t("crm.accountDetail.task.description")}>
        <textarea id="crm-task-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={crmInputClass} />
      </Field>
    </FormDialog>
  );
}

// ─── Contacto (alta y edición) ──────────────────────────────────────────────

export function ContactDialog({ account, contact, onClose }: { account: DialogAccount; contact?: CrmContact; onClose: () => void }) {
  const t = useTranslations("crm.accountDetail.contact");
  const tc = useTranslations();
  const create = useCreateContact();
  const update = useUpdateContact();
  const departments = useCrmCatalog("department");
  const [form, setForm] = useState({
    first_name: contact?.first_name ?? "",
    last_name: contact?.last_name ?? "",
    position: contact?.position ?? "",
    department: contact?.department ? String(contact.department) : "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    mobile: contact?.mobile ?? "",
    linkedin: contact?.linkedin ?? "",
    notes: contact?.notes ?? "",
    is_primary: contact?.is_primary ?? false,
  });
  const mutation = contact ? update : create;
  const conflict = !contact && create.error?.kind === "duplicado" ? create.error : null;
  const set = (key: keyof typeof form, value: string | boolean) => {
    mutation.reset();
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const text = (key: "first_name" | "last_name" | "position" | "email" | "phone" | "mobile" | "linkedin", label: string, type = "text") => (
    <Field id={`crm-contact-${key}`} label={label}>
      <input id={`crm-contact-${key}`} type={type} value={form[key]} onChange={(e) => set(key, e.target.value)} className={crmInputClass} required={key === "first_name"} />
    </Field>
  );

  function submit(force: boolean) {
    const data = { ...form, department: form.department ? Number(form.department) : null };
    if (contact) update.mutate({ id: contact.id, ...data }, { onSuccess: onClose });
    else create.mutate({ account: account.id, ...data, force }, { onSuccess: onClose });
  }

  return (
    <FormDialog
      title={contact ? t("editTitle") : t("title")}
      onClose={onClose}
      pending={mutation.isPending}
      error={conflict ? null : mutation.error}
      canSubmit={!!form.first_name.trim()}
      submitLabel={tc("crm.common.save")}
      onSubmit={() => submit(false)}
      extraActions={
        conflict ? (
          <Button type="button" variant="danger" onClick={() => submit(true)} disabled={mutation.isPending}>
            {t("force")}
          </Button>
        ) : null
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {text("first_name", t("firstName"))}
        {text("last_name", t("lastName"))}
        {text("position", t("position"))}
        <Field id="crm-contact-department" label={t("department")}>
          <select id="crm-contact-department" value={form.department} onChange={(e) => set("department", e.target.value)} className={crmInputClass}>
            <option value="">{tc("crm.common.none")}</option>
            {departments.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        {text("email", t("email"), "email")}
        {text("phone", t("phone"), "tel")}
        {text("mobile", t("mobile"), "tel")}
        {text("linkedin", t("linkedin"), "url")}
      </div>
      <Field id="crm-contact-notes" label={t("notes")}>
        <textarea id="crm-contact-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={crmInputClass} />
      </Field>
      <label className="inline-flex items-center gap-1.5 text-sm">
        <input type="checkbox" checked={form.is_primary} onChange={(e) => set("is_primary", e.target.checked)} />
        {t("primary")}
      </label>
      {conflict ? (
        <>
          <DuplicatesList duplicates={conflict.duplicates ?? []} />
          <p role="alert" className="text-sm text-error">
            {conflict.detail ?? t("conflict")}
          </p>
        </>
      ) : null}
    </FormDialog>
  );
}

// ─── Oportunidad ────────────────────────────────────────────────────────────

export function OpportunityDialog({ account, onClose }: { account: DialogAccount; onClose: () => void }) {
  const t = useTranslations("crm.accountDetail.opportunity");
  const tc = useTranslations();
  const create = useCreateOpportunity();
  const products = useCrmCatalog("product");
  const [name, setName] = useState("");
  const [product, setProduct] = useState("");
  const [amount, setAmount] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [createdId, setCreatedId] = useState<number | null>(null);

  if (createdId !== null) {
    return (
      <FormDialog title={t("title")} onClose={onClose} onSubmit={onClose} submitLabel={tc("common.close")}>
        <p role="status" className="text-sm text-text-base">
          {t("created")}{" "}
          <Link href={crmOpportunityHref(createdId)} className="font-medium text-primary-700 underline">
            {t("open")}
          </Link>
        </p>
      </FormDialog>
    );
  }
  return (
    <FormDialog
      title={t("title")}
      onClose={onClose}
      pending={create.isPending}
      error={create.error}
      canSubmit={!!name.trim()}
      submitLabel={tc("crm.common.save")}
      onSubmit={() =>
        create.mutate(
          {
            account: account.id,
            name: name.trim(),
            product: product ? Number(product) : null,
            estimated_amount: amount ? amount : null,
            expected_close_date: closeDate || null,
          } as never,
          { onSuccess: (created) => setCreatedId(created.id) },
        )
      }
    >
      <Field id="crm-opp-name" label={t("name")}>
        <input id="crm-opp-name" value={name} onChange={(e) => setName(e.target.value)} className={crmInputClass} required />
      </Field>
      <Field id="crm-opp-product" label={t("product")}>
        <select id="crm-opp-product" value={product} onChange={(e) => setProduct(e.target.value)} className={crmInputClass}>
          <option value="">{tc("crm.common.none")}</option>
          {products.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id="crm-opp-amount" label={t("amount")}>
          <input id="crm-opp-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={crmInputClass} />
        </Field>
        <Field id="crm-opp-close" label={t("closeDate")}>
          <input id="crm-opp-close" type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} className={crmInputClass} />
        </Field>
      </div>
    </FormDialog>
  );
}

// ─── Documento ──────────────────────────────────────────────────────────────

export function DocumentDialog({ account, onClose }: { account: DialogAccount; onClose: () => void }) {
  const t = useTranslations("crm.accountDetail.document");
  const tc = useTranslations();
  const upload = useUploadDocument();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("other");
  const [received, setReceived] = useState(false);
  return (
    <FormDialog
      title={t("title")}
      onClose={onClose}
      pending={upload.isPending}
      error={upload.error}
      canSubmit={!!file}
      submitLabel={t("upload")}
      onSubmit={() =>
        file &&
        upload.mutate(
          { file, account: account.id, name: name.trim() || file.name, category: category as CrmDocumentCategory, received },
          { onSuccess: onClose },
        )
      }
    >
      <Field id="crm-doc-file" label={t("file")}>
        <input
          id="crm-doc-file"
          type="file"
          className="text-sm"
          onChange={(e) => {
            const picked = e.target.files?.[0] ?? null;
            setFile(picked);
            if (picked && !name) setName(picked.name);
          }}
        />
      </Field>
      <Field id="crm-doc-name" label={t("name")}>
        <input id="crm-doc-name" value={name} onChange={(e) => setName(e.target.value)} className={crmInputClass} />
      </Field>
      <Field id="crm-doc-category" label={t("category")}>
        <select id="crm-doc-category" value={category} onChange={(e) => setCategory(e.target.value)} className={crmInputClass}>
          {CRM_DOCUMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {tc(CRM_DOCUMENT_CATEGORY_LABELS[c])}
            </option>
          ))}
        </select>
      </Field>
      <label className="inline-flex items-center gap-1.5 text-sm">
        <input type="checkbox" checked={received} onChange={(e) => setReceived(e.target.checked)} />
        {t("received")}
      </label>
    </FormDialog>
  );
}

// ─── Nota ───────────────────────────────────────────────────────────────────

export function NoteDialog({ account, onClose }: { account: DialogAccount; onClose: () => void }) {
  const t = useTranslations("crm.accountDetail.note");
  const tc = useTranslations();
  const create = useCreateNote();
  const [body, setBody] = useState("");
  const [important, setImportant] = useState(false);
  const [pinned, setPinned] = useState(false);
  return (
    <FormDialog
      title={t("title")}
      onClose={onClose}
      pending={create.isPending}
      error={create.error}
      canSubmit={!!body.trim()}
      submitLabel={tc("crm.common.save")}
      onSubmit={() => create.mutate({ account: account.id, body: body.trim(), important, pinned }, { onSuccess: onClose })}
    >
      <Field id="crm-note-body" label={t("body")}>
        <textarea id="crm-note-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} className={crmInputClass} required />
      </Field>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
          {t("important")}
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          {t("pinned")}
        </label>
      </div>
    </FormDialog>
  );
}

// ─── Reunión (cita futura) ──────────────────────────────────────────────────

const MEETING_KINDS = ["meeting", "video_call", "call", "visit", "demo"] as const;

export function MeetingDialog({ account, onClose }: { account: DialogAccount; onClose: () => void }) {
  const t = useTranslations("crm.accountDetail.meeting");
  const tc = useTranslations();
  const create = useCreateActivity();
  const contacts = useCrmAccountContacts(account.id);
  const [kind, setKind] = useState<string>("meeting");
  const [at, setAt] = useState(() => tomorrowAt(10));
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  return (
    <FormDialog
      title={t("title")}
      onClose={onClose}
      pending={create.isPending}
      error={create.error}
      localError={localError}
      canSubmit={!!at}
      submitLabel={t("schedule")}
      onSubmit={() => {
        const iso = fromLocalInput(at);
        if (!iso || new Date(iso).getTime() <= Date.now()) {
          setLocalError(t("pastError"));
          return;
        }
        setLocalError(null);
        create.mutate(
          { account: account.id, kind: kind as CrmActivityKind, occurred_at: iso, title: title.trim(), contacts: selected },
          { onSuccess: onClose },
        );
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id="crm-meeting-kind" label={t("kind")}>
          <select id="crm-meeting-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={crmInputClass}>
            {MEETING_KINDS.map((k) => (
              <option key={k} value={k}>
                {tc(CRM_ACTIVITY_KIND_LABELS[k])}
              </option>
            ))}
          </select>
        </Field>
        <Field id="crm-meeting-at" label={t("at")}>
          <input id="crm-meeting-at" type="datetime-local" value={at} onChange={(e) => { setLocalError(null); setAt(e.target.value); }} className={crmInputClass} required />
        </Field>
      </div>
      <Field id="crm-meeting-title" label={t("meetingTitle")}>
        <input id="crm-meeting-title" value={title} onChange={(e) => setTitle(e.target.value)} className={crmInputClass} />
      </Field>
      {contacts.data?.length ? (
        <fieldset>
          <legend className={crmLabelClass}>{t("contacts")}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {contacts.data.map((c) => (
              <label key={c.id} className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={(e) => setSelected(e.target.checked ? [...selected, c.id] : selected.filter((id) => id !== c.id))}
                />
                {contactFullName(c)}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </FormDialog>
  );
}
