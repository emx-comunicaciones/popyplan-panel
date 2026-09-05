"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { logout } from "@/hooks/useAuth";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    await logout();
    router.replace("/login");
  }

  return (
    <Button variant="secondary" onClick={handleClick} disabled={pending}>
      {pending ? "Cerrando sesión…" : "Cerrar sesión"}
    </Button>
  );
}
