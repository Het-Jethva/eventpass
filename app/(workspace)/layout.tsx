import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { EventPassMark } from "@/components/eventpass-mark";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/features/staff-identity/sign-out-button";
import { getActiveStaffSession } from "@/lib/staff-session";

import { signOutAction } from "./actions";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const staffSession = await getActiveStaffSession();

  if (!staffSession) {
    redirect("/sign-in");
  }

  return (
    <div className="flex min-h-svh flex-col bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6">
          <EventPassMark />
          <nav
            className="hidden h-full items-center border-l pl-6 sm:flex"
            aria-label="Primary"
          >
            <span className="flex h-full items-center border-b-2 border-foreground px-2 text-sm font-medium">
              Events
            </span>
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Badge
              variant="secondary"
              className="hidden max-w-52 sm:inline-flex"
            >
              <span className="truncate">{staffSession.user.email}</span>
            </Badge>
            <form action={signOutAction}>
              <SignOutButton />
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
