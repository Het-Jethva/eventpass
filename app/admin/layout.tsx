import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { WorkspaceHeader } from "@/components/workspace-header";
import { getActiveStaffSession } from "@/lib/staff-session";

import { signOutAction } from "@/app/(workspace)/actions";

// The administration surface sits outside the `(workspace)` route group because
// it is not scoped to an event, but it is the same signed-in product and needs
// the same chrome — it had none at all, which left the page that can suspend an
// account with no way back to the events list and no sign-out.
export default async function AdminLayout({
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
      <WorkspaceHeader
        email={staffSession.user.email}
        signOutAction={signOutAction}
        showAdmin
      />
      {children}
    </div>
  );
}
