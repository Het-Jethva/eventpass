"use client";

import { useActionState } from "react";
import Link from "next/link";
import { IconAlertCircle, IconArrowLeft, IconPlus } from "@tabler/icons-react";

import {
  createEventAction,
  initialCreateEventFormState,
  type CreateEventFormField,
  type CreateEventFormState,
} from "@/app/(workspace)/events/new/actions";
import { updateEventAction } from "@/app/(workspace)/events/[eventId]/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

const TIME_ZONE_SUGGESTIONS = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/Berlin",
  "Europe/London",
  "America/Chicago",
  "America/Los_Angeles",
  "America/New_York",
];

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

function subtractLocalMinutes(value: string, minutes: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return "";

  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]) - minutes,
    ),
  );
  return date.toISOString().slice(0, 16);
}

function setEmptyFormValue(
  form: HTMLFormElement,
  field: CreateEventFormField,
  nextValue: string,
) {
  const input = form.elements.namedItem(field);
  if (input instanceof HTMLInputElement && !input.value) input.value = nextValue;
}

export function CreateEventForm({
  eventId,
  initialValues,
  slugImmutable = false,
}: {
  eventId?: string;
  initialValues?: Record<CreateEventFormField, string>;
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

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {state.status === "error" ? (
        <Alert variant="destructive">
          <IconAlertCircle aria-hidden="true" />
          <AlertTitle>Draft Event not created</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <FieldSet className="rounded-2xl border bg-background p-5 sm:p-6">
          <FieldLegend>Event details</FieldLegend>
          <FieldDescription>
            Set the identity, Event Time Zone, and schedule attendees will see.
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
              label="Event Slug"
              state={state}
              description="Used in the public link. You can change it until publication."
            >
              <Input
                id="slug"
                name="slug"
                autoComplete="off"
                defaultValue={value(state, "slug")}
                aria-invalid={Boolean(state.fieldErrors?.slug)}
                placeholder="annual-engineering-showcase"
                minLength={3}
                maxLength={80}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
                readOnly={slugImmutable}
                disabled={isPending}
              />
            </EventField>
            <EventField field="description" label="Description" state={state}>
              <Textarea
                id="description"
                name="description"
                defaultValue={value(state, "description")}
                aria-invalid={Boolean(state.fieldErrors?.description)}
                placeholder="Tell Attendees what to expect."
                maxLength={4000}
                rows={5}
                required
                disabled={isPending}
                className="min-h-28"
              />
            </EventField>
            <EventField
              field="eventTimeZone"
              label="Event Time Zone"
              state={state}
              description="Use an IANA time zone such as Asia/Kolkata."
            >
              <Input
                id="eventTimeZone"
                name="eventTimeZone"
                list="event-time-zones"
                autoComplete="off"
                defaultValue={value(state, "eventTimeZone") ?? "Asia/Kolkata"}
                aria-invalid={Boolean(state.fieldErrors?.eventTimeZone)}
                required
                disabled={isPending}
              />
              <datalist id="event-time-zones">
                {TIME_ZONE_SUGGESTIONS.map((timeZone) => (
                  <option key={timeZone} value={timeZone} />
                ))}
              </datalist>
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
                onChange={(changeEvent) => {
                  const form = changeEvent.currentTarget.form;
                  if (!form) return;
                  setEmptyFormValue(
                    form,
                    "registrationClosesAtLocal",
                    changeEvent.currentTarget.value,
                  );
                  setEmptyFormValue(
                    form,
                    "checkInOpensAtLocal",
                    subtractLocalMinutes(changeEvent.currentTarget.value, 60),
                  );
                }}
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
                onChange={(changeEvent) => {
                  const form = changeEvent.currentTarget.form;
                  if (form) {
                    setEmptyFormValue(
                      form,
                      "checkInClosesAtLocal",
                      changeEvent.currentTarget.value,
                    );
                  }
                }}
              />
            </EventField>
          </FieldGroup>
        </FieldSet>

        <FieldSet className="rounded-2xl border bg-background p-5 sm:p-6">
          <FieldLegend>Venue and capacity</FieldLegend>
          <FieldDescription>
            Describe the in-person Venue and the maximum Event Capacity.
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
            <EventField field="capacity" label="Event Capacity" state={state}>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                inputMode="numeric"
                min={1}
                max={1_000_000}
                defaultValue={value(state, "capacity")}
                aria-invalid={Boolean(state.fieldErrors?.capacity)}
                placeholder="250"
                required
                disabled={isPending}
              />
            </EventField>
            <EventField field="venueAddress" label="Formatted address" state={state}>
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

        <FieldSet className="rounded-2xl border bg-background p-5 sm:p-6">
          <FieldLegend>Operational windows</FieldLegend>
          <FieldDescription>
            Enter local times in the Event Time Zone selected above.
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
                required
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
                required
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
                aria-invalid={Boolean(state.fieldErrors?.checkInClosesAtLocal)}
                required
                disabled={isPending}
              />
            </EventField>
          </FieldGroup>
        </FieldSet>
      </FieldGroup>

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-end">
        <Link
          href={eventId ? `/events/${eventId}` : "/events"}
          className={cn(buttonVariants({ variant: "outline" }), "h-10")}
        >
          <IconArrowLeft data-icon="inline-start" />
          Cancel
        </Link>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? (
            <>
              <Spinner data-icon="inline-start" />
              {isEditing ? "Saving Draft Event…" : "Creating Draft Event…"}
            </>
          ) : (
            <>
              <IconPlus data-icon="inline-start" />
              {isEditing ? "Save Draft Event" : "Create Draft Event"}
            </>
          )}
        </Button>
      </div>
      <p className="sr-only" aria-live="polite">
        {isPending
          ? isEditing
            ? "Saving the Draft Event configuration."
            : "Creating the Draft Event and Event Owner assignment."
          : ""}
      </p>
    </form>
  );
}
