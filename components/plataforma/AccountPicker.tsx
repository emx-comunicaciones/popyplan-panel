"use client";

/**
 * Elegir una cuenta por correo o usuario (`GET /api/users/users/?search=`,
 * solo `superadmin`; para el resto la búsqueda devuelve vacío, ver
 * `hooks/useUserSearch.ts`). Sustituye al campo «Id de usuario» a mano.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";

import { SearchPicker, type PickerOption } from "@/components/ui/SearchPicker";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useUserSearch } from "@/hooks/useUserSearch";

export function AccountPicker({
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
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const search = useUserSearch(useDebouncedValue(query));
  return (
    <SearchPicker
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      query={query}
      onQueryChange={setQuery}
      minChars={2}
      loading={search.isFetching}
      error={search.isError}
      errorText={t("plataforma.userSearch.error")}
      options={search.data?.map((user) => ({ id: user.id, label: `${user.username} (${user.email})` }))}
    />
  );
}
