"use client";

/**
 * Elegir a una persona de la entidad por su nombre (listado del panel,
 * `hooks/usePeople.ts`); sustituye al campo «Persona (id)» a mano.
 */
import { useMemo, useState } from "react";

import { SearchPicker, type PickerOption } from "@/components/ui/SearchPicker";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePeople } from "@/hooks/usePeople";
import type { PersonRow } from "@/lib/api/types";
import { isInvitedPersonRow } from "@/lib/people/invitedRow";
import { presetPeriod } from "@/lib/metrics/period";

export function PersonPicker({
  orgId,
  id,
  label,
  value,
  onChange,
}: {
  orgId: number | string;
  id: string;
  label: string;
  value: PickerOption | null;
  onChange: (option: PickerOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query.trim());
  const period = useMemo(() => presetPeriod("mes"), []);
  const people = usePeople(orgId, period, search ? { search } : {});
  return (
    <SearchPicker
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      query={query}
      onQueryChange={setQuery}
      loading={people.isFetching}
      error={people.isError}
      options={people.data?.results
          .filter((row): row is PersonRow => !isInvitedPersonRow(row))
          .map((row) => ({ id: row.user_id, label: row.public_name }))}
    />
  );
}
