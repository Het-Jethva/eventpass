import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  IconAlertTriangle,
  IconClockQuestion,
  IconDeviceMobile,
} from "@tabler/icons-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { getOrganizerEvent } from "@/features/events/server/get-event";
import { listCheckInConflicts } from "@/features/admission/server/synchronize-offline";
import { listActiveCheckIns } from "@/features/admission/server/check-in-corrections";
import { ReasonedCheckInAction } from "@/features/admission/reasoned-check-in-action";
import { ActiveCheckInSearch } from "@/features/admission/active-check-in-search";
import { getActiveStaffSession } from "@/lib/staff-session";

import {
  resolveCheckInConflictAction,
  reverseOrganizerCheckInAction,
} from "./actions";

export const metadata: Metadata = { title: "Check-in operations" };

function formatAttemptTime(value: Date, timeZone: string) {
  // Components spelled out because `dateStyle`/`timeStyle` cannot be combined
  // with `timeZoneName`; the mix throws "Invalid option : option".
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(value);
}

export default async function CheckInConflictsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ error?: string; notice?: string; q?: string }>;
}) {
  const [{ eventId }, query, session] = await Promise.all([
    params,
    searchParams,
    getActiveStaffSession(),
  ]);
  if (!session) redirect("/sign-in");

  const checkInSearch = query.q?.trim() ?? "";

  const [event, conflicts, activeCheckIns] = await Promise.all([
    getOrganizerEvent(eventId, session.user.id),
    listCheckInConflicts({ eventId, actorUserId: session.user.id }),
    listActiveCheckIns({
      eventId,
      actorUserId: session.user.id,
      searchQuery: checkInSearch,
    }),
  ]);
  if (!event) notFound();

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-headline">
            Check-in operations
          </h1>
          <Badge variant={conflicts.length > 0 ? "destructive" : "secondary"}>
            {conflicts.length} unresolved
          </Badge>
        </div>
        <p className="max-w-3xl text-support text-muted-foreground">
          Two phones that cannot reach each other cannot prevent the same ticket from being
          accepted at separate entrances. Offline acceptance remains provisional
          until synchronization compares every scan.
        </p>
      </div>

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

      <section aria-labelledby="active-check-ins-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="active-check-ins-heading" className="font-medium">
              Active check-ins
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Organizer corrections preserve the original check-in and every
              scan attempt while making the ticket admissible again.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2">
          <ActiveCheckInSearch initialQuery={checkInSearch} />
          {/*
            States what was searched, not just what is shown. The list is capped
            because it exists to correct one specific check-in, and an
            Organizer should never be left wondering whether the person they
            searched for was simply below the cut.
          */}
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {checkInSearch
              ? `${activeCheckIns.matchingCount.toLocaleString()} of ${activeCheckIns.totalCount.toLocaleString()} active check-ins match`
              : activeCheckIns.matchingCount > activeCheckIns.limit
                ? `Showing the ${activeCheckIns.limit} most recent of ${activeCheckIns.totalCount.toLocaleString()} active check-ins. Search by name to find any of them.`
                : `${activeCheckIns.totalCount.toLocaleString()} active check-in${activeCheckIns.totalCount === 1 ? "" : "s"}`}
          </p>
        </div>

        {activeCheckIns.rows.length === 0 ? (
          <div className="border-y bg-background px-5 py-8 text-center text-sm text-muted-foreground">
            {checkInSearch
              ? "No active check-ins match that name. Every active check-in was searched, not just the visible page."
              : "Nobody is checked in yet."}
          </div>
        ) : (
          <div className="divide-y rounded-2xl border bg-background">
            {activeCheckIns.rows.map((activeCheckIn) => (
              <div
                key={activeCheckIn.id}
                className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <h3 className="font-medium">{activeCheckIn.attendeeName}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Checked in by {activeCheckIn.actorName} at{" "}
                    {formatAttemptTime(
                      activeCheckIn.checkedInAt,
                      event.eventTimeZone,
                    )}
                  </p>
                </div>
                <ReasonedCheckInAction
                  label="Reverse check-in"
                  title={`Reverse ${activeCheckIn.attendeeName}'s check-in?`}
                  description="The check-in is undone and the history is kept. The ticket can be admitted again."
                  reasonDescription="The correction, and your reason for it, are kept permanently."
                  variant="destructive"
                  action={reverseOrganizerCheckInAction.bind(
                    null,
                    eventId,
                    activeCheckIn.id,
                  )}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {conflicts.length === 0 ? (
        <section className="border-y bg-background px-5 py-10 text-center sm:px-6">
          <h2 className="font-medium">No unresolved check-in Conflicts</h2>
          <p className="mx-auto mt-2 max-w-xl text-support text-muted-foreground">
            High-confidence cross-device collisions are resolved automatically
            by the earliest device-recorded attempt. Conflicts appear here only
            when Timestamp Confidence requires organizer review.
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
                      Choose which scan counts
                    </legend>
                    <p className="mt-1 text-support text-muted-foreground">
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
                      permanent record.
                    </FieldDescription>
                  </Field>
                  <FormSubmitButton
                    pendingLabel="Resolving conflict"
                    className="min-h-11 sm:self-start"
                  >
                    Resolve Check-in Conflict
                  </FormSubmitButton>
                </FieldGroup>
              </form>
            </section>
          ))}
        </div>
      )}

    </>
  );
}
