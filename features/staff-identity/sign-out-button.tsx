"use client";

import { useFormStatus } from "react-dom";
import { IconLogout } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function SignOutButton() {
  const { pending } = useFormStatus();

  return (
    <Button variant="ghost" type="submit" disabled={pending}>
      {pending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <IconLogout data-icon="inline-start" />
      )}
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
