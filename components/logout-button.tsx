"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      await authClient.signOut();
      toast.success("Sie wurden abgemeldet.");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Abmeldung fehlgeschlagen. Bitte erneut versuchen.");
      setPending(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={pending}>
      Abmelden
    </Button>
  );
}
