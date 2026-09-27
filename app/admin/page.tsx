import { redirect } from "next/navigation";

import { isPlatformAdmin } from "@/features/admin/admin-policy";
import { AdminDashboard } from "@/features/admin/admin-dashboard";
import {
  listPlatformAccounts,
  listPlatformEvents,
} from "@/features/admin/server/admin-application";
import { getActiveStaffSession } from "@/lib/staff-session";

import {
  fetchSupportAttendeeDataAction,
  grantSupportAccessAction,
  reactivateEventAction,
  reactivateStaffAccountAction,
  revokeSupportAccessAction,
  suspendEventAction,
  suspendStaffAccountAction,
} from "./actions";

export const metadata = {
  title: "Platform Administration — EventPass",
  description: "Command-only operations surface for abuse handling and support.",
};

export default async function AdminPage() {
  const staffSession = await getActiveStaffSession();

  if (!staffSession) {
    redirect("/sign-in");
  }

  const isAdmin = isPlatformAdmin({
    userEmail: staffSession.user.email,
    isPlatformAdminFlag: staffSession.user.isPlatformAdmin,
  });

  if (!isAdmin) {
    redirect("/events");
  }

  const [accounts, events] = await Promise.all([
    listPlatformAccounts({
      actorUserId: staffSession.user.id,
    }),
    listPlatformEvents({
      actorUserId: staffSession.user.id,
    }),
  ]);

  return (
    <AdminDashboard
      accounts={accounts}
      events={events}
      onSuspendAccount={suspendStaffAccountAction}
      onReactivateAccount={reactivateStaffAccountAction}
      onSuspendEvent={suspendEventAction}
      onReactivateEvent={reactivateEventAction}
      onGrantSupportAccess={grantSupportAccessAction}
      onRevokeSupportAccess={revokeSupportAccessAction}
      onFetchSupportData={fetchSupportAttendeeDataAction}
    />
  );
}
