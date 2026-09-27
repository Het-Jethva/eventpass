import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { WorkspaceHeader } from "@/components/workspace-header";
import { isPlatformAdmin } from "@/features/admin/admin-policy";
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
      <WorkspaceHeader
        email={staffSession.user.email}
        signOutAction={signOutAction}
        showAdmin={isPlatformAdmin({
          userEmail: staffSession.user.email,
          isPlatformAdminFlag: staffSession.user.isPlatformAdmin,
        })}
      />
      {children}
    </div>
  );
}
