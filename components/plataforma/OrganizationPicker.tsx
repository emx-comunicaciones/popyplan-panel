"use client";

/** Elegir una entidad por nombre (sustituye a los campos «paraguas (id)»). */
import { useState } from "react";

import { SearchPicker, type PickerOption } from "@/components/ui/SearchPicker";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useOrganizations } from "@/hooks/useOrganizations";

export function OrganizationPicker({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: PickerOption | null;
  onChange: (option: PickerOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query.trim());
  const organizations = useOrganizations(search ? { search } : {});
  return (
    <SearchPicker
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      query={query}
      onQueryChange={setQuery}
      loading={organizations.isFetching}
      error={organizations.isError}
      options={organizations.data?.results.map((org) => ({ id: org.id, label: org.name }))}
    />
  );
}
