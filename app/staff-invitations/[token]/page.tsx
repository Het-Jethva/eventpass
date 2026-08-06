import { IconAlertCircle, IconMailCheck, IconUsers } from "@tabler/icons-react";

import { PublicAuthShell } from "@/components/public-auth-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { PendingLink } from "@/components/pending-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { inspectStaffInvitation } from "@/features/staffing/server/staffing-application";
import { normalizeStaffEmail } from "@/features/staff-identity/normalize-staff-email";
import { getActiveStaffSession } from "@/lib/staff-session";

import { acceptStaffInvitationAction } from "./actions";

export default async function StaffInvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ token }, query, session] = await Promise.all([
    params,
    searchParams,
    getActiveStaffSession(),
  ]);
  const invitation = await inspectStaffInvitation(token);
  const emailMatches =
    invitation && session
      ? normalizeStaffEmail(session.user.email) === invitation.normalizedEmail
      : false;
  const roleLabel =
    invitation?.role === "organizer" ? "Organizer" : "Check-in volunteer";

  return (
    <PublicAuthShell>
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-3">
          <IconUsers aria-hidden="true" className="size-8" />
          <h1 className="text-3xl font-headline">Staff invitation</h1>
        </div>

        {!invitation || query.error ? (
          <Alert variant="destructive">
            <IconAlertCircle aria-hidden="true" />
            <AlertTitle>This invitation is no longer usable</AlertTitle>
            <AlertDescription>
              It may have expired, been revoked, already been used, or belong to another signed-in email.
            </AlertDescription>
          </Alert>
        ) : invitation.suspended ? (
          <Alert variant="warning">
            <IconAlertCircle aria-hidden="true" />
            <AlertTitle>Event currently unavailable</AlertTitle>
            <AlertDescription>
              This Event is currently unavailable, so the Staff Invitation
              cannot be accepted right now.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl border p-5">
              <p className="text-sm text-muted-foreground">Event</p>
              <p className="mt-1 font-medium">{invitation.eventName}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="secondary">{roleLabel}</Badge>
                <Badge variant="outline">{invitation.normalizedEmail}</Badge>
              </div>
            </div>

            {!session ? (
              <div className="flex flex-col gap-3">
                <p className="text-support text-muted-foreground">
                  Sign in as {invitation.normalizedEmail} to accept this email-bound invitation.
                </p>
                <PendingLink
                  href={`/sign-in?callbackUrl=${encodeURIComponent(`/staff-invitations/${token}`)}`}
                  className={buttonVariants()}
                  pendingLabel="Opening sign in"
                >
                  <IconMailCheck data-icon="inline-start" />
                  Sign in to accept
                </PendingLink>
              </div>
            ) : emailMatches ? (
              <form action={acceptStaffInvitationAction.bind(null, token)}>
                <FormSubmitButton
                  className="w-full"
                  pendingLabel="Accepting invitation"
                >
                  Accept invitation
                </FormSubmitButton>
              </form>
            ) : (
              <Alert variant="destructive">
                <IconAlertCircle aria-hidden="true" />
                <AlertTitle>Signed in with a different email</AlertTitle>
                <AlertDescription>
                  Sign out and return as {invitation.normalizedEmail}. Access cannot be assigned to another identity.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>
    </PublicAuthShell>
  );
}
