import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  IconClock,
  IconMailForward,
  IconShieldCheck,
  IconUserCheck,
  IconUsers,
} from "@tabler/icons-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StaffRemoveControl } from "@/features/staffing/staff-remove-control";
import {
  getEventStaffing,
  StaffingAuthorizationError,
} from "@/features/staffing/server/staffing-application";
import { canManageRole } from "@/features/staffing/staffing-policy";
import { getActiveStaffSession } from "@/lib/staff-session";

import {
  inviteStaffAction,
  proposeOwnershipTransferAction,
  removeEventStaffAction,
  revokeStaffInvitationAction,
} from "./actions";
import { acceptOwnershipTransferAction } from "./transfer-actions";

export const metadata: Metadata = { title: "Staff" };

const ROLE_LABELS = {
  owner: "Event owner",
  organizer: "Organizer",
  check_in_volunteer: "Check-in volunteer",
} as const;

// Base UI's Select.Value renders the raw `value` unless the root is given the
// label mapping, which is how an invitation form came to offer the literal
// string `check_in_volunteer` to an organizer.
const INVITE_ROLE_ITEMS = [
  { value: "organizer", label: ROLE_LABELS.organizer },
  { value: "check_in_volunteer", label: ROLE_LABELS.check_in_volunteer },
];

function formatDeadline(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function EventStaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ eventId }, query, session] = await Promise.all([
    params,
    searchParams,
    getActiveStaffSession(),
  ]);
  if (!session) redirect("/sign-in");

  let staffing;
  try {
    staffing = await getEventStaffing(eventId, session.user.id);
  } catch (error) {
    if (error instanceof StaffingAuthorizationError) notFound();
    throw error;
  }

  const organizers = staffing.staff.filter((member) => member.role === "organizer");
  const transfer = staffing.activeTransfer;
  const transferTarget = transfer
    ? staffing.staff.find((member) => member.userId === transfer.proposedOwnerUserId)
    : null;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-headline">Staff</h1>
        <p className="max-w-2xl text-support text-muted-foreground">
          Assign access to this event only. Every invitation, role change,
          removal, and ownership change is kept permanently.
        </p>
      </div>

      {staffing.suspended ? (
        <Alert variant="warning">
          <IconShieldCheck aria-hidden="true" />
          <AlertTitle>Event currently unavailable</AlertTitle>
          <AlertDescription>
            Staffing changes are temporarily paused. Existing staff and
            read-only Event history remain available.
          </AlertDescription>
        </Alert>
      ) : null}

      {query.error ? (
        <Alert variant="destructive">
          <IconShieldCheck aria-hidden="true" />
          <AlertTitle>Staffing not changed</AlertTitle>
          <AlertDescription>{query.error}</AlertDescription>
        </Alert>
      ) : null}
      {query.notice ? (
        <Alert>
          <IconUserCheck aria-hidden="true" />
          <AlertTitle>Staffing updated</AlertTitle>
          <AlertDescription>{query.notice}</AlertDescription>
        </Alert>
      ) : null}

      <section className="rounded-2xl border bg-background" aria-labelledby="current-staff-heading">
        <div className="border-b p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <IconUsers aria-hidden="true" className="size-5" />
            <h2 id="current-staff-heading" className="font-medium">Current staff</h2>
          </div>
        </div>
        <ul className="divide-y">
          {staffing.staff.map((member) => {
            const removable =
              member.role !== "owner" && canManageRole(staffing.actorRole, member.role);
            return (
              <li key={member.assignmentId} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{member.name}</p>
                    <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                      {ROLE_LABELS[member.role]}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{member.email}</p>
                </div>
                {removable ? (
                  <StaffRemoveControl
                    action={removeEventStaffAction.bind(null, eventId, member.assignmentId)}
                    name={member.name}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-background p-5 sm:p-6">
          <div className="mb-6 flex items-start gap-3">
            <IconMailForward aria-hidden="true" className="mt-0.5 size-5" />
            <div>
              <h2 className="font-medium">Send an invitation</h2>
              <p className="mt-1 text-support text-muted-foreground">
                The single-use link is bound to this email and expires after 24 hours.
              </p>
            </div>
          </div>
          <form action={inviteStaffAction.bind(null, eventId)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="invitation-email">Email address</FieldLabel>
                <Input id="invitation-email" name="email" type="email" autoCapitalize="none" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="invitation-role">Role</FieldLabel>
                <Select
                  name="role"
                  items={
                    staffing.actorRole === "owner"
                      ? INVITE_ROLE_ITEMS
                      : INVITE_ROLE_ITEMS.filter((item) => item.value !== "organizer")
                  }
                  defaultValue="check_in_volunteer"
                  required
                >
                  <SelectTrigger id="invitation-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {staffing.actorRole === "owner" ? (
                        <SelectItem value="organizer">Organizer</SelectItem>
                      ) : null}
                      <SelectItem value="check_in_volunteer">Check-in volunteer</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Organizers manage configuration and volunteers. Check-in volunteers receive admission access only.
                </FieldDescription>
              </Field>
              <Button type="submit">Send invitation</Button>
            </FieldGroup>
          </form>
        </div>

        <div className="rounded-2xl border bg-background p-5 sm:p-6">
          <div className="mb-6 flex items-start gap-3">
            <IconClock aria-hidden="true" className="mt-0.5 size-5" />
            <div>
              <h2 className="font-medium">Pending invitations</h2>
              <p className="mt-1 text-support text-muted-foreground">
                Revoke any invitation that should no longer grant access.
              </p>
            </div>
          </div>
          {staffing.invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invitations are waiting to be accepted.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {staffing.invitations.map((invitation) => (
                <li key={invitation.id} className="flex flex-col gap-3 rounded-xl border p-4">
                  <div>
                    <p className="truncate text-sm font-medium">{invitation.normalizedEmail}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ROLE_LABELS[invitation.role]} · expires {formatDeadline(invitation.expiresAt)}
                    </p>
                  </div>
                  {canManageRole(staffing.actorRole, invitation.role) ? (
                    <form action={revokeStaffInvitationAction.bind(null, eventId, invitation.id)}>
                      <Button size="sm" variant="outline" type="submit">Revoke invitation</Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {staffing.actorRole === "owner" || transfer?.proposedOwnerUserId === session.user.id ? (
        <section className="rounded-2xl border bg-background p-5 sm:p-6" aria-labelledby="ownership-heading">
          <h2 id="ownership-heading" className="font-medium">Ownership transfer</h2>
          {transfer ? (
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-support text-muted-foreground">
                Proposed to <span className="font-medium text-foreground">{transferTarget?.name ?? "Organizer"}</span>; expires {formatDeadline(transfer.expiresAt)}.
              </p>
              {transfer.proposedOwnerUserId === session.user.id ? (
                <form action={acceptOwnershipTransferAction.bind(null, eventId, transfer.id)}>
                  <Button type="submit">Accept ownership</Button>
                </form>
              ) : null}
            </div>
          ) : staffing.actorRole === "owner" ? (
            organizers.length > 0 ? (
              <form action={proposeOwnershipTransferAction.bind(null, eventId)} className="mt-5">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="proposed-owner">New owner</FieldLabel>
                    <Select
                      name="proposedOwnerUserId"
                      items={organizers.map((organizer) => ({
                        value: organizer.userId,
                        label: `${organizer.name} · ${organizer.email}`,
                      }))}
                      required
                    >
                      <SelectTrigger id="proposed-owner" className="w-full sm:max-w-md">
                        <SelectValue placeholder="Choose an organizer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {organizers.map((organizer) => (
                            <SelectItem key={organizer.userId} value={organizer.userId}>
                              {organizer.name} · {organizer.email}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      The proposal expires after 24 hours. Ownership changes only when that organizer accepts.
                    </FieldDescription>
                  </Field>
                  <Button type="submit" variant="outline">Propose transfer</Button>
                </FieldGroup>
              </form>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Invite an organizer before proposing a transfer.
              </p>
            )
          ) : null}
        </section>
      ) : null}

    </>
  );
}
