"use client";

import { useActionState, useState } from "react";
import { IconAlertCircle, IconArrowLeft, IconPlus } from "@tabler/icons-react";

import { createEventAction } from "@/app/(workspace)/events/new/actions";
import {
  initialCreateEventFormState,
  type CreateEventFormField,
  type CreateEventFormState,
} from "@/app/(workspace)/events/new/form-state";
import { updateEventAction } from "@/app/(workspace)/events/[eventId]/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PendingLink } from "@/components/pending-link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import timeZones from "@/lib/time-zones.json";

function EventField({
  children,
  description,
  field,
  label,
  state,
}: {
  children: React.ReactNode;
  description?: string;
  field: CreateEventFormField;
  label: string;
  state: CreateEventFormState;
}) {
  const errors = state.fieldErrors?.[field];

  return (
    <Field data-invalid={Boolean(errors?.length)}>
      <FieldLabel htmlFor={field}>{label}</FieldLabel>
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={errors?.map((message) => ({ message }))} />
    </Field>
  );
}

function value(state: CreateEventFormState, field: CreateEventFormField) {
  return state.values?.[field];
}

export function CreateEventForm({
  eventId,
  initialValues,
  published = false,
  slugImmutable = false,
}: {
  eventId?: string;
  initialValues?: Record<CreateEventFormField, string>;
  published?: boolean;
  slugImmutable?: boolean;
} = {}) {
  const action = eventId
    ? updateEventAction.bind(null, eventId)
    : createEventAction;
  const [state, formAction, isPending] = useActionState(
    action,
    initialValues
      ? { ...initialCreateEventFormState, values: initialValues }
      : initialCreateEventFormState,
  );
  const isEditing = Boolean(eventId);
  const [slug, setSlug] = useState(initialValues?.slug ?? "");
  const selectedTimeZone = value(state, "eventTimeZone") ?? "Asia/Kolkata";
  const availableTimeZones = timeZones.includes(selectedTimeZone)
    ? timeZones
    : [selectedTimeZone, ...timeZones];

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <p className="text-sm text-muted-foreground">
        All fields are required unless marked optional. Registration and
        check-in times default to your event schedule when you save.
      </p>
      {state.status === "error" ? (
        <Alert variant="destructive">
          <IconAlertCircle aria-hidden="true" />
          <AlertTitle>Event not saved</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <FieldSet className="rounded-2xl border bg-background p-5 sm:p-6">
          <FieldLegend>Event details</FieldLegend>
          <FieldDescription>
            The name, time zone, and schedule attendees will see.
          </FieldDescription>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <EventField field="name" label="Event name" state={state}>
              <Input
                id="name"
                name="name"
                autoComplete="off"
                defaultValue={value(state, "name")}
                aria-invalid={Boolean(state.fieldErrors?.name)}
                placeholder="Annual engineering showcase"
                maxLength={160}
                required
                disabled={isPending}
              />
            </EventField>
            <EventField
              field="slug"
              label="Web address"
              state={state}
              description={slugImmutable ? "This address is fixed because the event has been published." : "You can change this address until you publish the event."}
            >
              <Input
                id="slug"
                name="slug"
                autoComplete="off"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                aria-invalid={Boolean(state.fieldErrors?.slug)}
                placeholder="annual-engineering-showcase"
                minLength={3}
                maxLength={80}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
                readOnly={slugImmutable}
                disabled={isPending}
              />
              <p className="break-all text-sm text-muted-foreground">
                Public link: <span className="font-mono">{process.env.NEXT_PUBLIC_APP_URL}/e/{slug || "your-event"}</span>
              </p>
            </EventField>
            <EventField field="description" label="Description" state={state}>
              <Textarea
                id="description"
                name="description"
                defaultValue={value(state, "description")}
                aria-invalid={Boolean(state.fieldErrors?.description)}
                placeholder="Tell guests what to expect."
                maxLength={4000}
                rows={5}
                required
                disabled={isPending}
                className="min-h-28"
              />
            </EventField>
            <EventField
              field="eventTimeZone"
              label="Time zone"
              state={state}
              description="Choose the event’s city or region. All schedule times use this zone. Type a city name while the list is open to jump to it."
            >
              <select
                className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50"
                id="eventTimeZone"
                name="eventTimeZone"
                defaultValue={selectedTimeZone}
                aria-invalid={Boolean(state.fieldErrors?.eventTimeZone)}
                required
                disabled={isPending}
              >
                {[...availableTimeZones]
                  .sort((a, b) =>
                    (a.split("/").at(-1) ?? a).localeCompare(
                      b.split("/").at(-1) ?? b,
                    ),
                  )
                  .map((timeZone) => (
                    <option key={timeZone} value={timeZone}>
                      {timeZone
                        .split("/")
                        .reverse()
                        .join(", ")
                        .replaceAll("_", " ")}
                    </option>
                  ))}
              </select>
            </EventField>
            <EventField field="startsAtLocal" label="Starts" state={state}>
              <Input
                id="startsAtLocal"
                name="startsAtLocal"
                type="datetime-local"
                defaultValue={value(state, "startsAtLocal")}
                aria-invalid={Boolean(state.fieldErrors?.startsAtLocal)}
                required
                disabled={isPending}
              />
            </EventField>
            <EventField field="endsAtLocal" label="Ends" state={state}>
              <Input
                id="endsAtLocal"
                name="endsAtLocal"
                type="datetime-local"
                defaultValue={value(state, "endsAtLocal")}
                aria-invalid={Boolean(state.fieldErrors?.endsAtLocal)}
                required
                disabled={isPending}
              />
            </EventField>
          </FieldGroup>
        </FieldSet>

        <FieldSet className="rounded-2xl border bg-background p-5 sm:p-6">
          <FieldLegend>Venue and capacity</FieldLegend>
          <FieldDescription>
            Where it happens, and how many people can come.
          </FieldDescription>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <EventField field="venueName" label="Venue name" state={state}>
              <Input
                id="venueName"
                name="venueName"
                defaultValue={value(state, "venueName")}
                aria-invalid={Boolean(state.fieldErrors?.venueName)}
                placeholder="Main auditorium"
                maxLength={160}
                required
                disabled={isPending}
              />
            </EventField>
            <EventField
              field="capacity"
              label="Capacity"
              state={state}
              description="Between 1 and 3,000 attendees."
            >
              <Input
                id="capacity"
                name="capacity"
                type="number"
                inputMode="numeric"
                min={1}
                max={3_000}
                defaultValue={value(state, "capacity")}
                aria-invalid={Boolean(state.fieldErrors?.capacity)}
                placeholder="250"
                required
                disabled={isPending}
              />
            </EventField>
            <EventField
              field="venueAddress"
              label="Formatted address"
              state={state}
            >
              <Input
                id="venueAddress"
                name="venueAddress"
                defaultValue={value(state, "venueAddress")}
                aria-invalid={Boolean(state.fieldErrors?.venueAddress)}
                placeholder="University Road, Ahmedabad, Gujarat"
                maxLength={500}
                required
                disabled={isPending}
              />
            </EventField>
            <EventField
              field="venueMapUrl"
              label="Map link"
              state={state}
              description="Optional. Use a full https:// URL."
            >
              <Input
                id="venueMapUrl"
                name="venueMapUrl"
                type="url"
                inputMode="url"
                defaultValue={value(state, "venueMapUrl")}
                aria-invalid={Boolean(state.fieldErrors?.venueMapUrl)}
                placeholder="https://maps.example.com/venue"
                disabled={isPending}
              />
            </EventField>
          </FieldGroup>
        </FieldSet>

        <details
          className="rounded-2xl border bg-background p-5 sm:p-6"
          onInvalidCapture={(event) => {
            event.currentTarget.open = true;
          }}
          open={
            isEditing ||
            Boolean(
              state.fieldErrors?.registrationOpensAtLocal ||
              state.fieldErrors?.registrationClosesAtLocal ||
              state.fieldErrors?.checkInOpensAtLocal ||
              state.fieldErrors?.checkInClosesAtLocal,
            )
          }
        >
          <summary className="min-h-11 cursor-pointer rounded-md py-2 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
            Adjust registration and check-in times{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </summary>
          <FieldSet className="mt-4">
            <FieldLegend className="sr-only">
              Registration and check-in times
            </FieldLegend>
            <FieldDescription>
              Leave these adjustments blank to close registration at the event
              start, open check-in one hour before, and close check-in at the
              event end. Defaults are applied when you save. All times use your
              selected time zone.
            </FieldDescription>
            <FieldGroup className="grid gap-5 sm:grid-cols-2">
              <EventField
                field="registrationOpensAtLocal"
                label="Registration opens"
                state={state}
              >
                <Input
                  id="registrationOpensAtLocal"
                  name="registrationOpensAtLocal"
                  type="datetime-local"
                  defaultValue={value(state, "registrationOpensAtLocal")}
                  aria-invalid={Boolean(
                    state.fieldErrors?.registrationOpensAtLocal,
                  )}
                  required
                  disabled={isPending}
                />
              </EventField>
              <EventField
                field="registrationClosesAtLocal"
                label="Registration closes"
                state={state}
              >
                <Input
                  id="registrationClosesAtLocal"
                  name="registrationClosesAtLocal"
                  type="datetime-local"
                  defaultValue={value(state, "registrationClosesAtLocal")}
                  aria-invalid={Boolean(
                    state.fieldErrors?.registrationClosesAtLocal,
                  )}
                  disabled={isPending}
                />
              </EventField>
              <EventField
                field="checkInOpensAtLocal"
                label="Check-in opens"
                state={state}
              >
                <Input
                  id="checkInOpensAtLocal"
                  name="checkInOpensAtLocal"
                  type="datetime-local"
                  defaultValue={value(state, "checkInOpensAtLocal")}
                  aria-invalid={Boolean(state.fieldErrors?.checkInOpensAtLocal)}
                  disabled={isPending}
                />
              </EventField>
              <EventField
                field="checkInClosesAtLocal"
                label="Check-in closes"
                state={state}
              >
                <Input
                  id="checkInClosesAtLocal"
                  name="checkInClosesAtLocal"
                  type="datetime-local"
                  defaultValue={value(state, "checkInClosesAtLocal")}
                  aria-invalid={Boolean(
                    state.fieldErrors?.checkInClosesAtLocal,
                  )}
                  disabled={isPending}
                />
              </EventField>
            </FieldGroup>
          </FieldSet>
        </details>
      </FieldGroup>

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-end">
        <PendingLink
          href={eventId ? `/events/${eventId}` : "/events"}
          className={cn(buttonVariants({ variant: "outline" }), "h-10")}
          pendingLabel="Canceling"
        >
          <IconArrowLeft data-icon="inline-start" />
          Cancel
        </PendingLink>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? (
            <>
              <Spinner data-icon="inline-start" />
              {isEditing
                ? `Saving ${published ? "Published" : "Draft"} Event…`
                : "Creating draft…"}
            </>
          ) : (
            <>
              <IconPlus data-icon="inline-start" />
              {isEditing
                ? `Save ${published ? "Published" : "Draft"} Event`
                : "Create draft"}
            </>
          )}
        </Button>
      </div>
      <p className="sr-only" aria-live="polite">
        {isPending
          ? isEditing
            ? `Saving the ${published ? "Published" : "Draft"} Event configuration.`
            : "Creating the draft and assigning you as owner."
          : ""}
      </p>
    </form>
  );
}
