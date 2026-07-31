"use client";

import { useActionState } from "react";
import {
  IconAlertCircle,
  IconEdit,
  IconMailForward,
  IconRefresh,
  IconTicketOff,
} from "@tabler/icons-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import type { RegistrationManagementView } from "@/features/tickets/server/ticket-application";
import {
  cancelRegistrationAction,
  replaceTicketAction,
  resendTicketAction,
  updateRegistrationAction,
} from "@/app/tickets/[token]/actions";
import {
  initialManagementActionState,
  type ManagementActionState,
} from "@/app/tickets/[token]/form-state";

type FieldView = RegistrationManagementView["fields"][number];

function Feedback({ state }: { state: ManagementActionState }) {
  if (state.status === "idle") return null;
  return (
    <Alert variant={state.status === "error" ? "destructive" : "default"}>
      <IconAlertCircle aria-hidden="true" />
      <AlertTitle>{state.status === "success" ? "Done" : "Action not completed"}</AlertTitle>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}

function answerErrors(state: ManagementActionState, fieldId: string) {
  return state.fieldErrors?.[`answer.${fieldId}`];
}

function answerValue(state: ManagementActionState, field: FieldView) {
  return state.values?.answers[field.id] ?? field.value;
}

function EditableAnswer({
  field,
  state,
  pending,
}: {
  field: FieldView;
  state: ManagementActionState;
  pending: boolean;
}) {
  const errors = answerErrors(state, field.id);
  const value = answerValue(state, field);
  if (field.answerType === "short_text" || field.answerType === "long_text") {
    const Control = field.answerType === "long_text" ? Textarea : Input;
    return (
      <Field data-invalid={Boolean(errors?.length)}>
        <FieldLabel htmlFor={`answer-${field.id}`}>
          {field.label}{field.required ? " *" : ""}
        </FieldLabel>
        {field.helpText ? <FieldDescription>{field.helpText}</FieldDescription> : null}
        <Control
          id={`answer-${field.id}`}
          name={`answer.${field.id}`}
          defaultValue={typeof value === "string" ? value : ""}
          required={field.required}
          maxLength={field.answerType === "short_text" ? 500 : 4000}
          disabled={pending}
          aria-invalid={Boolean(errors?.length)}
        />
        <FieldError errors={errors?.map((message) => ({ message }))} />
      </Field>
    );
  }

  if (field.answerType === "acknowledgment") {
    return (
      <Field data-invalid={Boolean(errors?.length)}>
        <label
          htmlFor={`answer-${field.id}`}
          className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm"
        >
          <input
            id={`answer-${field.id}`}
            type="checkbox"
            name={`answer.${field.id}`}
            value="true"
            defaultChecked={value === true || value === "true"}
            required={field.required}
            disabled={pending}
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

  const selected = new Set(Array.isArray(value) ? value : [value]);
  return (
    <FieldSet data-invalid={Boolean(errors?.length)}>
      <FieldLegend variant="label">
        {field.label}{field.required ? " *" : ""}
      </FieldLegend>
      {field.helpText ? <FieldDescription>{field.helpText}</FieldDescription> : null}
      <div className="grid gap-3">
        {field.choices.map((choice) => (
          <label
            key={choice.id}
            htmlFor={`answer-${field.id}-${choice.id}`}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm has-checked:border-foreground has-checked:bg-muted/50"
          >
            <input
              id={`answer-${field.id}-${choice.id}`}
              type={field.answerType === "single_choice" ? "radio" : "checkbox"}
              name={`answer.${field.id}`}
              value={choice.id}
              defaultChecked={selected.has(choice.id)}
              required={field.required && field.answerType === "single_choice"}
              disabled={pending}
              className="size-4 accent-foreground"
            />
            {choice.label}
          </label>
        ))}
      </div>
      <FieldError errors={errors?.map((message) => ({ message }))} />
    </FieldSet>
  );
}

export function RegistrationManagementControls({
  token,
  attendeeName,
  email,
  fields,
  canEdit,
  canReplaceOrCancel,
}: {
  token: string;
  attendeeName: string;
  email: string;
  fields: RegistrationManagementView["fields"];
  canEdit: boolean;
  canReplaceOrCancel: boolean;
}) {
  const [editState, editAction, editPending] = useActionState(
    updateRegistrationAction.bind(null, token, fields.map(({ id }) => id)),
    initialManagementActionState,
  );
  const [resendState, resendAction, resendPending] = useActionState(
    resendTicketAction.bind(null, token),
    initialManagementActionState,
  );
  const [replaceState, replaceAction, replacePending] = useActionState(
    replaceTicketAction.bind(null, token),
    initialManagementActionState,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelRegistrationAction.bind(null, token),
    initialManagementActionState,
  );

  return (
    <div className="space-y-10 print:hidden">
      {canEdit ? (
        <section aria-labelledby="edit-registration-heading">
          <div>
            <h2 id="edit-registration-heading" className="text-lg font-medium">
              Registration details
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Update attendee-authored details before registration closes.
            </p>
          </div>
          <form action={editAction} className="mt-6 space-y-6">
            <Feedback state={editState} />
            <FieldGroup>
              <Field data-invalid={Boolean(editState.fieldErrors?.name)}>
                <FieldLabel htmlFor="management-name">Name *</FieldLabel>
                <Input
                  id="management-name"
                  name="name"
                  autoComplete="name"
                  defaultValue={editState.values?.name ?? attendeeName}
                  required
                  maxLength={200}
                  disabled={editPending}
                  aria-invalid={Boolean(editState.fieldErrors?.name)}
                />
                <FieldError errors={editState.fieldErrors?.name?.map((message) => ({ message }))} />
              </Field>
              <Field>
                <FieldLabel htmlFor="management-email">Verified email address</FieldLabel>
                <Input id="management-email" value={email} disabled readOnly />
                <FieldDescription>The verified email address cannot be changed.</FieldDescription>
              </Field>
              {fields.map((field) => (
                <EditableAnswer
                  key={field.id}
                  field={field}
                  state={editState}
                  pending={editPending}
                />
              ))}
            </FieldGroup>
            <Button type="submit" disabled={editPending}>
              {editPending ? <Spinner data-icon="inline-start" /> : <IconEdit data-icon="inline-start" />}
              {editPending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </section>
      ) : null}

      <section aria-labelledby="ticket-actions-heading" className="border-t pt-8">
        <h2 id="ticket-actions-heading" className="text-lg font-medium">Ticket actions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Resending keeps the current ticket unchanged. Replacement permanently invalidates it.
        </p>
        <div className="mt-5 space-y-4">
          <Feedback state={resendState} />
          <Feedback state={replaceState} />
          <form action={resendAction}>
            <Button type="submit" variant="outline" disabled={resendPending}>
              {resendPending ? <Spinner data-icon="inline-start" /> : <IconMailForward data-icon="inline-start" />}
              {resendPending ? "Sending…" : "Resend existing ticket"}
            </Button>
          </form>
          {canReplaceOrCancel ? (
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="outline" />}>
                <IconRefresh data-icon="inline-start" />
                Replace ticket
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Replace this ticket?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The current QR code and ticket code stop working permanently. A new ticket is issued and emailed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep current ticket</AlertDialogCancel>
                  <form action={replaceAction}>
                    <AlertDialogAction type="submit" disabled={replacePending}>
                      Replace ticket
                    </AlertDialogAction>
                  </form>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </section>

      {canReplaceOrCancel ? (
        <section aria-labelledby="cancel-registration-heading" className="border-t pt-8">
          <h2 id="cancel-registration-heading" className="text-lg font-medium">Cancel registration</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This frees up the place and stops the ticket working, for good.
          </p>
          <div className="mt-5 space-y-4">
            <Feedback state={cancelState} />
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="destructive" />}>
                <IconTicketOff data-icon="inline-start" />
                Cancel registration
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this registration?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This cannot be undone. The ticket will stop working, and the
                    place may go to someone on the waiting list.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <form action={cancelAction}>
                    <AlertDialogAction type="submit" variant="destructive" disabled={cancelPending}>
                      Cancel registration
                    </AlertDialogAction>
                  </form>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </section>
      ) : null}
    </div>
  );
}
