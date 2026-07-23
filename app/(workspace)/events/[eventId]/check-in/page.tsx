import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconClockQuestion,
  IconDeviceMobile,
} from "@tabler/icons-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { getOrganizerEvent } from "@/features/events/server/get-event";
import { listCheckInConflicts } from "@/features/admission/server/synchronize-offline";
import { getActiveStaffSession } from "@/lib/staff-session";

import { resolveCheckInConflictAction } from "./actions";

export const metadata: Metadata = { title: "Check-in Conflicts" };

function formatAttemptTime(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone,
    timeZoneName: "short",
  }).format(value);
}

export default async function CheckInConflictsPage({
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

  const [event, conflicts] = await Promise.all([
    getOrganizerEvent(eventId, session.user.id),
    listCheckInConflicts({ eventId, actorUserId: session.user.id }),
  ]);
  if (!event) notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <Link
          href={`/events/${eventId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <IconArrowLeft aria-hidden="true" className="size-4" />
          {event.name}
        </Link>
        <div className="mt-5 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Check-in Conflicts
            </h1>
            <Badge variant={conflicts.length > 0 ? "destructive" : "secondary"}>
              {conflicts.length} unresolved
            </Badge>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Isolated Scanner Devices cannot prevent the same Ticket from being
            accepted at separate entrances. Offline acceptance remains
            provisional until synchronization compares every Scan Attempt.
          </p>
        </div>
      </header>

      {query.error ? (
        <Alert variant="destructive">
          <IconAlertTriangle aria-hidden="true" />
          <AlertTitle>Resolution not saved</AlertTitle>
          <AlertDescription>{query.error}</AlertDescription>
        </Alert>
      ) : null}
      {query.notice ? (
        <Alert>
          <IconClockQuestion aria-hidden="true" />
          <AlertTitle>Conflict resolved</AlertTitle>
          <AlertDescription>{query.notice}</AlertDescription>
        </Alert>
      ) : null}

      {conflicts.length === 0 ? (
        <section className="border-y bg-background px-5 py-10 text-center sm:px-6">
          <h2 className="font-medium">No unresolved Check-in Conflicts</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            High-confidence cross-device collisions are resolved automatically
            by the earliest device-recorded attempt. Conflicts appear here only
            when Timestamp Confidence requires Organizer review.
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-8">
          {conflicts.map((conflict) => (
            <section
              key={conflict.id}
              aria-labelledby={`conflict-${conflict.id}`}
              className="overflow-hidden rounded-2xl border bg-background"
            >
              <div className="border-b p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2
                      id={`conflict-${conflict.id}`}
                      className="font-medium"
                    >
                      {conflict.attendeeName}
                    </h2>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      Ticket {conflict.ticketId}
                    </p>
                  </div>
                  <Badge variant="destructive">Organizer review required</Badge>
                </div>
              </div>

              <form
                action={resolveCheckInConflictAction.bind(
                  null,
                  eventId,
                  conflict.id,
                )}
                className="p-5 sm:p-6"
              >
                <FieldGroup>
                  <fieldset>
                    <legend className="text-sm font-medium">
                      Select the authoritative Scan Attempt
                    </legend>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Device time is not sufficiently reliable to choose
                      automatically. Confirm the entrance evidence before
                      deciding.
                    </p>
                    <div className="mt-4 divide-y rounded-xl border">
                      {conflict.attempts.map((attempt, index) => (
                        <label
                          key={attempt.id}
                          className="flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-muted/50"
                        >
                          <input
                            type="radio"
                            name="authoritativeAttemptId"
                            value={attempt.id}
                            required
                            defaultChecked={
                              conflict.attempts.length === 1 && index === 0
                            }
                            className="mt-1 size-4 accent-current"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">
                                {attempt.actorName}
                              </span>
                              <Badge
                                variant={
                                  attempt.timestampConfidence === "low"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {attempt.timestampConfidence === "low"
                                  ? "Low confidence"
                                  : "High confidence"}
                              </Badge>
                            </span>
                            <span className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                              <IconDeviceMobile
                                aria-hidden="true"
                                className="size-4"
                              />
                              {formatAttemptTime(
                                attempt.attemptedAt,
                                event.eventTimeZone,
                              )}
                            </span>
                            <span className="mt-1 block font-mono text-xs text-muted-foreground">
                              Device {attempt.scannerDeviceId}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <Field>
                    <FieldLabel htmlFor={`reason-${conflict.id}`}>
                      Resolution reason
                    </FieldLabel>
                    <Textarea
                      id={`reason-${conflict.id}`}
                      name="reason"
                      required
                      minLength={1}
                      maxLength={500}
                      placeholder="Describe the entrance evidence used for this decision."
                    />
                    <FieldDescription>
                      The selected attempt and this reason are retained in the
                      immutable Audit Entry.
                    </FieldDescription>
                  </Field>
                  <Button type="submit" className="min-h-11 sm:self-start">
                    Resolve Check-in Conflict
                  </Button>
                </FieldGroup>
              </form>
            </section>
          ))}
        </div>
      )}

      <Link
        href={`/events/${eventId}`}
        className={buttonVariants({ variant: "outline" })}
      >
        Return to Event overview
      </Link>
    </main>
  );
}
