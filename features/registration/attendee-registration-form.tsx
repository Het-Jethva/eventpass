"use client";

import { useActionState } from "react";
import { IconAlertCircle, IconMailForward } from "@tabler/icons-react";

import { submitRegistrationAction } from "@/app/e/[slug]/actions";
import {
  initialRegistrationActionState,
  type RegistrationActionState,
} from "@/app/e/[slug]/form-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import type { PublicRegistrationField } from "./registration-submission";

function answerValue(state: RegistrationActionState, fieldId: string) {
  return state.values?.answers[fieldId];
}

function answerErrors(state: RegistrationActionState, fieldId: string) {
  return state.fieldErrors?.[`answer.${fieldId}`];
}

function TextAnswer({
  field,
  state,
  pending,
}: {
  field: PublicRegistrationField;
  state: RegistrationActionState;
  pending: boolean;
}) {
  const errors = answerErrors(state, field.id);
  const id = `answer-${field.id}`;
  const shared = {
    id,
    name: `answer.${field.id}`,
    defaultValue:
      typeof answerValue(state, field.id) === "string"
        ? (answerValue(state, field.id) as string)
        : "",
    required: field.required,
    disabled: pending,
    "aria-invalid": Boolean(errors?.length),
    "aria-describedby": field.helpText ? `${id}-description` : undefined,
  };

  return (
    <Field data-invalid={Boolean(errors?.length)}>
      <FieldLabel htmlFor={id}>
        {field.label}
        {field.required ? <span aria-hidden="true">*</span> : null}
      </FieldLabel>
      {field.answerType === "long_text" ? (
        <Textarea {...shared} rows={5} maxLength={4_000} />
      ) : (
        <Input {...shared} maxLength={500} />
      )}
      {field.helpText ? (
        <FieldDescription id={`${id}-description`}>
          {field.helpText}
        </FieldDescription>
      ) : null}
      <FieldError errors={errors?.map((message) => ({ message }))} />
    </Field>
  );
}

function ChoiceAnswer({
  field,
  state,
  pending,
}: {
  field: PublicRegistrationField;
  state: RegistrationActionState;
  pending: boolean;
}) {
  const errors = answerErrors(state, field.id);
  const saved = answerValue(state, field.id);
  const selected = new Set(Array.isArray(saved) ? saved : [saved]);

  return (
    <FieldSet data-invalid={Boolean(errors?.length)}>
      <FieldLegend variant="label">
        {field.label}
        {field.required ? <span aria-hidden="true"> *</span> : null}
      </FieldLegend>
      {field.helpText ? <FieldDescription>{field.helpText}</FieldDescription> : null}
      <div className="grid gap-3">
        {field.choices.map((choice) => {
          const id = `answer-${field.id}-${choice.id}`;
          return (
            <label
              key={choice.id}
              htmlFor={id}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm has-checked:border-foreground has-checked:bg-muted/50"
            >
              <input
                id={id}
                type={field.answerType === "single_choice" ? "radio" : "checkbox"}
                name={`answer.${field.id}`}
                value={choice.id}
                defaultChecked={selected.has(choice.id)}
                required={field.required && field.answerType === "single_choice"}
                disabled={pending}
                aria-invalid={Boolean(errors?.length)}
                className="size-4 accent-foreground"
              />
              {choice.label}
            </label>
          );
        })}
      </div>
      <FieldError errors={errors?.map((message) => ({ message }))} />
    </FieldSet>
  );
}

function AcknowledgmentAnswer({
  field,
  state,
  pending,
}: {
  field: PublicRegistrationField;
  state: RegistrationActionState;
  pending: boolean;
}) {
  const errors = answerErrors(state, field.id);
  const id = `answer-${field.id}`;
  const saved = answerValue(state, field.id);

  return (
    <Field data-invalid={Boolean(errors?.length)}>
      <label
        htmlFor={id}
        className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm"
      >
        <input
          id={id}
          type="checkbox"
          name={`answer.${field.id}`}
          value="true"
          defaultChecked={saved === true || saved === "true"}
          required={field.required}
          disabled={pending}
          aria-invalid={Boolean(errors?.length)}
          className="mt-0.5 size-4 accent-foreground"
        />
        <span>
          <span className="font-medium">{field.label}</span>
          {field.helpText ? (
            <span className="mt-1 block text-muted-foreground">{field.helpText}</span>
          ) : null}
        </span>
      </label>
      <FieldError errors={errors?.map((message) => ({ message }))} />
    </Field>
  );
}

export function AttendeeRegistrationForm({
  slug,
  fields,
}: {
  slug: string;
  fields: PublicRegistrationField[];
}) {
  const action = submitRegistrationAction.bind(
    null,
    slug,
    fields.map(({ id }) => id),
  );
  const [state, formAction, pending] = useActionState(
    action,
    initialRegistrationActionState,
  );

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.status !== "idle" ? (
        <Alert variant={state.status === "error" ? "destructive" : "default"}>
          <IconAlertCircle aria-hidden="true" />
          <AlertTitle>
            {state.status === "existing"
              ? "Registration already exists"
              : "Registration not submitted"}
          </AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Name *</FieldLabel>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            defaultValue={state.values?.name}
            maxLength={200}
            required
            disabled={pending}
            aria-invalid={Boolean(state.fieldErrors?.name)}
          />
          <FieldError
            errors={state.fieldErrors?.name?.map((message) => ({ message }))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Email address *</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            defaultValue={state.values?.email}
            maxLength={320}
            required
            disabled={pending}
            aria-invalid={Boolean(state.fieldErrors?.email)}
          />
          <FieldDescription>
            We’ll send a single-use verification link that expires in 15 minutes.
          </FieldDescription>
          <FieldError
            errors={state.fieldErrors?.email?.map((message) => ({ message }))}
          />
        </Field>

        {fields.map((field) => {
          if (field.answerType === "short_text" || field.answerType === "long_text") {
            return <TextAnswer key={field.id} field={field} state={state} pending={pending} />;
          }
          if (
            field.answerType === "single_choice" ||
            field.answerType === "multiple_choice"
          ) {
            return <ChoiceAnswer key={field.id} field={field} state={state} pending={pending} />;
          }
          return (
            <AcknowledgmentAnswer
              key={field.id}
              field={field}
              state={state}
              pending={pending}
            />
          );
        })}
      </FieldGroup>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Spinner data-icon="inline-start" />
            Registering…
          </>
        ) : (
          <>
            <IconMailForward data-icon="inline-start" />
            Register
          </>
        )}
      </Button>
      <p className="text-support text-muted-foreground">
        Submitting does not confirm your place. The next screen will state whether
        your place is held for 15 minutes, or to confirm your spot on the waitlist.
      </p>
      <p className="sr-only" aria-live="polite">
        {pending ? "Submitting your registration." : ""}
      </p>
    </form>
  );
}
