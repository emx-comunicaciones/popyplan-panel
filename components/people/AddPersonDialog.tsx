"use client";

/**
 * «Añadir persona» (tarea W3b, `docs/PANEL.md` §3b.2): invitación manual,
 * una persona. Solo abre desde `PersonasTable` cuando `canManage`
 * (titular/moderador); `useInvite` también traduce el 403 del backend
 * por si acaso. `comunidad` es un select de las comunidades de la propia
 * entidad (`useEntityCommunities`); `referente` es un select de los
 * miembros del equipo con rol `referente` (`useOrgMembers`, filtrado en
 * el cliente) — ninguno de los dos lleva nombre de persona
 * (`OrgMembership` no expone nombre de cuenta, invariante 1/9), así que
 * ambos se etiquetan por `public_name` (carry-over de la tarea P7,
 * `docs/PANEL.md` §10.3: `OrgMembership` ya lleva `public_name`/`photo`
 * de `user`), igual que `components/entidad/PersonSheet.tsx::AssignReferentForm`.
 */
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useEntityCommunities } from "@/hooks/useEntityCommunities";
import { useInvite } from "@/hooks/useInvite";
import { useOrgMembers } from "@/hooks/useOrgMembers";

export interface AddPersonDialogProps {
  orgId: number | string;
  onClose: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AddPersonDialog({ orgId, onClose }: AddPersonDialogProps) {
  const communities = useEntityCommunities(orgId);
  const members = useOrgMembers(orgId);
  const invite = useInvite(orgId);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [community, setCommunity] = useState("");
  const [referentUser, setReferentUser] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const referentes = (members.data ?? []).filter((member) => member.role === "referente");
  const trimmedEmail = email.trim();
  const emailValid = trimmedEmail.length > 0 && EMAIL_PATTERN.test(trimmedEmail);
  const canSubmit = trimmedEmail.length > 0;

  function resetForm() {
    setName("");
    setEmail("");
    setPhone("");
    setCommunity("");
    setReferentUser("");
    setEmailTouched(false);
  }

  function handleClose() {
    // Con la invitación en vuelo no se cierra ni se resetea la mutación:
    // `Dialog` ya bloquea `Escape` y el botón ×, y este guard cubre el
    // resto de caminos («Cancelar», que además va deshabilitado).
    if (invite.isPending) return;
    resetForm();
    setSentTo(null);
    invite.reset();
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailTouched(true);
    if (!emailValid) return;

    invite.mutate(
      {
        email: trimmedEmail,
        displayName: name,
        phone,
        community: community || null,
        referentUser: referentUser ? Number(referentUser) : null,
      },
      {
        onSuccess: () => {
          setSentTo(trimmedEmail);
          resetForm();
        },
      },
    );
  }

  return (
    <Dialog
      open
      titleId="add-person-title"
      title="Añadir persona"
      pending={invite.isPending}
      onClose={handleClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="add-person-name" className="mb-1 block text-sm font-medium text-text-form">
            Nombre
          </label>
          <input
            id="add-person-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="add-person-email" className="mb-1 block text-sm font-medium text-text-form">
            Email
          </label>
          <input
            id="add-person-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => setEmailTouched(true)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
          {emailTouched && !emailValid ? (
            <p role="alert" className="mt-1 text-xs text-error">
              Introduce un correo válido.
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="add-person-phone" className="mb-1 block text-sm font-medium text-text-form">
            Teléfono
          </label>
          <input
            id="add-person-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          />
        </div>
        <div>
          <label htmlFor="add-person-community" className="mb-1 block text-sm font-medium text-text-form">
            Comunidad
          </label>
          <select
            id="add-person-community"
            value={community}
            onChange={(event) => setCommunity(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          >
            <option value="">Sin comunidad (alta en «General»)</option>
            {(communities.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {communities.isError ? (
            <p className="mt-1 text-xs text-error">No se pudieron cargar las comunidades.</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="add-person-referent" className="mb-1 block text-sm font-medium text-text-form">
            Referente
          </label>
          <select
            id="add-person-referent"
            value={referentUser}
            onChange={(event) => setReferentUser(event.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-primary-700"
          >
            <option value="">Sin referente</option>
            {referentes.map((member) => (
              <option key={member.user} value={member.user}>
                {member.public_name}
              </option>
            ))}
          </select>
          {members.isError ? (
            <p className="mt-1 text-xs text-error">No se pudieron cargar los referentes.</p>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={!canSubmit || invite.isPending}>
            Enviar invitación
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={invite.isPending}
          >
            Cancelar
          </Button>
        </div>

        {invite.isError ? (
          <p role="alert" className="text-sm text-error">
            {invite.error.message}
          </p>
        ) : null}
        {sentTo ? <p className="text-sm text-success">Invitación enviada a {sentTo}.</p> : null}
      </form>
    </Dialog>
  );
}
