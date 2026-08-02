"use client";

import { useActionState, useState } from "react";
import {
  IconArchive,
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconPlus,
  IconRestore,
  IconTrash,
} from "@tabler/icons-react";

import { saveRegistrationFormAction } from "@/app/(workspace)/events/[eventId]/(sections)/form/actions";
import { initialSaveRegistrationFormState } from "@/app/(workspace)/events/[eventId]/(sections)/form/form-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  registrationFieldAnswerTypeLabels,
  registrationFieldAnswerTypes,
  type RegistrationFieldAnswerType,
} from "@/features/registration/registration-form-schema";
import type { OrganizerRegistrationField } from "@/features/registration/server/registration-form";

const answerTypeItems = registrationFieldAnswerTypes.map((value) => ({
  value,
  label: registrationFieldAnswerTypeLabels[value],
}));

function newChoice() {
  return { id: crypto.randomUUID(), label: "", archived: false };
}

function newField(answerType: RegistrationFieldAnswerType): OrganizerRegistrationField {
  const isChoice = answerType === "single_choice" || answerType === "multiple_choice";
  return {
    id: crypto.randomUUID(),
    answerType,
    label: "",
    helpText: "",
    required: false,
    archived: false,
    responseCount: 0,
    choices: isChoice ? [newChoice(), newChoice()] : [],
  };
}

function AttendeeFieldPreview({
  field,
}: {
  field: OrganizerRegistrationField;
}) {
  const fieldName = `preview-${field.id}`;
  const descriptionId = field.helpText ? `${fieldName}-description` : undefined;
  const label = field.label || "Untitled question";

  if (field.answerType === "acknowledgment") {
    return (
      <Field orientation="horizontal">
        <Checkbox
          id={fieldName}
          name={fieldName}
          required={field.required}
          aria-describedby={descriptionId}
        />
        <FieldContent>
          <FieldLabel htmlFor={fieldName} className="font-normal">
            {label}{field.required ? <span aria-hidden="true"> *</span> : null}
          </FieldLabel>
          {field.helpText ? (
            <FieldDescription id={descriptionId}>{field.helpText}</FieldDescription>
          ) : null}
        </FieldContent>
      </Field>
    );
  }

  if (field.answerType === "single_choice") {
    return (
      <FieldSet>
        <FieldLegend variant="label">
          {label}{field.required ? <span aria-hidden="true"> *</span> : null}
        </FieldLegend>
        {field.helpText ? <FieldDescription>{field.helpText}</FieldDescription> : null}
        <RadioGroup name={fieldName} required={field.required}>
          {field.choices.filter((choice) => !choice.archived).map((choice) => (
            <Field key={choice.id} orientation="horizontal">
              <RadioGroupItem id={`preview-${choice.id}`} value={choice.id} />
              <FieldLabel htmlFor={`preview-${choice.id}`} className="font-normal">
                {choice.label || "Untitled choice"}
              </FieldLabel>
            </Field>
          ))}
        </RadioGroup>
      </FieldSet>
    );
  }

  if (field.answerType === "multiple_choice") {
    return (
      <FieldSet>
        <FieldLegend variant="label">
          {label}{field.required ? <span aria-hidden="true"> *</span> : null}
        </FieldLegend>
        {field.helpText ? <FieldDescription>{field.helpText}</FieldDescription> : null}
        <FieldGroup className="gap-3">
          {field.choices.filter((choice) => !choice.archived).map((choice) => (
            <Field key={choice.id} orientation="horizontal">
              <Checkbox
                id={`preview-${choice.id}`}
                name={fieldName}
                value={choice.id}
              />
              <FieldLabel htmlFor={`preview-${choice.id}`} className="font-normal">
                {choice.label || "Untitled choice"}
              </FieldLabel>
            </Field>
          ))}
        </FieldGroup>
      </FieldSet>
    );
  }

  return (
    <Field>
      <FieldLabel htmlFor={fieldName}>
        {label}{field.required ? <span aria-hidden="true"> *</span> : null}
      </FieldLabel>
      {field.answerType === "long_text" ? (
        <Textarea
          id={fieldName}
          name={fieldName}
          required={field.required}
          aria-describedby={descriptionId}
          rows={4}
        />
      ) : (
        <Input
          id={fieldName}
          name={fieldName}
          required={field.required}
          aria-describedby={descriptionId}
        />
      )}
      {field.helpText ? (
        <FieldDescription id={descriptionId}>{field.helpText}</FieldDescription>
      ) : null}
    </Field>
  );
}

function RegistrationFormPreview({ fields }: { fields: OrganizerRegistrationField[] }) {
  const [status, setStatus] = useState("");
  const activeFields = fields.filter((field) => !field.archived);

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start" aria-labelledby="preview-heading">
      <div className="rounded-2xl border bg-background">
        <div className="border-b p-5 sm:p-6">
          <h2 id="preview-heading" className="font-medium">Attendee preview</h2>
          <p className="mt-1 text-support text-muted-foreground">
            Test the labels, help text, required state, and keyboard order.
          </p>
        </div>
        <form
          className="flex flex-col gap-6 p-5 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            const missingMultipleChoice = activeFields.find(
              (field) =>
                field.required &&
                field.answerType === "multiple_choice" &&
                new FormData(event.currentTarget).getAll(`preview-${field.id}`).length === 0,
            );
            if (missingMultipleChoice) {
              setStatus(`Choose at least one option for ${missingMultipleChoice.label || "the required question"}.`);
              event.currentTarget
                .querySelector<HTMLElement>(`[name="preview-${missingMultipleChoice.id}"]`)
                ?.focus();
              return;
            }
            setStatus("Validation passed. This preview does not submit a registration.");
          }}
          onInvalid={() => setStatus("Complete the required fields to test validation.")}
        >
          <FieldGroup>
            <Field>
              {/* Same treatment as the attendee form this previews: the
                  `required` attribute carries the meaning, the glyph is
                  decoration. A preview that spells the asterisk into its label
                  text is not previewing what the attendee's screen reader
                  hears. */}
              <FieldLabel htmlFor="preview-name">
                Name
                <span aria-hidden="true"> *</span>
              </FieldLabel>
              <Input id="preview-name" name="name" autoComplete="name" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="preview-email">
                Email address
                <span aria-hidden="true"> *</span>
              </FieldLabel>
              <Input
                id="preview-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
              />
              <FieldDescription>
                A verification link and ticket will be sent here.
              </FieldDescription>
            </Field>
            {activeFields.map((field) => (
              <AttendeeFieldPreview key={field.id} field={field} />
            ))}
          </FieldGroup>
          <Button type="submit" variant="outline">Test validation</Button>
          <p className="min-h-5 text-sm text-muted-foreground" aria-live="polite">
            {status}
          </p>
        </form>
      </div>
    </aside>
  );
}

function ChoiceEditor({
  field,
  onChange,
}: {
  field: OrganizerRegistrationField;
  onChange: (field: OrganizerRegistrationField) => void;
}) {
  return (
    <FieldSet className="rounded-xl bg-muted/50 p-4">
      <FieldLegend variant="label">Choices</FieldLegend>
      <FieldDescription>Choice identities remain stable after responses exist.</FieldDescription>
      <FieldGroup className="gap-3">
        {field.choices.map((choice, index) => (
          <Field key={choice.id} orientation="horizontal" data-disabled={choice.archived}>
            <Input
              aria-label={`Choice ${index + 1}`}
              value={choice.label}
              disabled={choice.archived}
              placeholder={`Choice ${index + 1}`}
              maxLength={200}
              onChange={(event) => {
                const choices = field.choices.map((candidate) =>
                  candidate.id === choice.id
                    ? { ...candidate, label: event.target.value }
                    : candidate,
                );
                onChange({ ...field, choices });
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={choice.archived ? `Restore choice ${index + 1}` : `Archive choice ${index + 1}`}
              onClick={() => {
                const choices = field.choices.map((candidate) =>
                  candidate.id === choice.id
                    ? { ...candidate, archived: !candidate.archived }
                    : candidate,
                );
                onChange({ ...field, choices });
              }}
            >
              {choice.archived ? <IconRestore /> : <IconArchive />}
            </Button>
          </Field>
        ))}
      </FieldGroup>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange({ ...field, choices: [...field.choices, newChoice()] })}
      >
        <IconPlus data-icon="inline-start" />
        Add choice
      </Button>
    </FieldSet>
  );
}

function FieldEditor({
  field,
  index,
  total,
  eventHasResponses,
  persisted,
  onChange,
  onMove,
  onRemove,
}: {
  field: OrganizerRegistrationField;
  index: number;
  total: number;
  eventHasResponses: boolean;
  persisted: boolean;
  onChange: (field: OrganizerRegistrationField) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}) {
  const isChoice = field.answerType === "single_choice" || field.answerType === "multiple_choice";

  return (
    <section className="rounded-2xl border bg-background" aria-labelledby={`field-${field.id}-heading`}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h3 id={`field-${field.id}-heading`} className="truncate text-sm font-medium">
            {field.label || `Question ${index + 1}`}
          </h3>
          {field.responseCount > 0 ? (
            <p className="text-xs text-muted-foreground">Answer type locked by existing responses</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Move question up" disabled={index === 0} onClick={() => onMove(-1)}>
            <IconArrowUp />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Move question down" disabled={index === total - 1} onClick={() => onMove(1)}>
            <IconArrowDown />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={field.archived ? "Restore question" : "Archive question"} onClick={() => onChange({ ...field, archived: !field.archived })}>
            {field.archived ? <IconRestore /> : <IconArchive />}
          </Button>
          {field.responseCount === 0 ? (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove question" onClick={onRemove}>
              <IconTrash />
            </Button>
          ) : null}
        </div>
      </div>

      <FieldGroup className="p-4 sm:p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`field-${field.id}-label`}>Question label</FieldLabel>
            <Input
              id={`field-${field.id}-label`}
              value={field.label}
              placeholder="What should attendees answer?"
              maxLength={200}
              disabled={field.archived}
              onChange={(event) => onChange({ ...field, label: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`field-${field.id}-type`}>Answer type</FieldLabel>
            <Select
              items={answerTypeItems}
              value={field.answerType}
              disabled={field.archived || field.responseCount > 0}
              onValueChange={(value) => {
                if (!value) return;
                const answerType = value as RegistrationFieldAnswerType;
                const nextIsChoice = answerType === "single_choice" || answerType === "multiple_choice";
                onChange({
                  ...field,
                  answerType,
                  choices: nextIsChoice
                    ? field.choices.length > 0
                      ? field.choices
                      : [newChoice(), newChoice()]
                    : [],
                });
              }}
            >
              <SelectTrigger id={`field-${field.id}-type`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {answerTypeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor={`field-${field.id}-help`}>Help text</FieldLabel>
          <Input
            id={`field-${field.id}-help`}
            value={field.helpText}
            placeholder="Optional guidance shown below the question"
            maxLength={500}
            disabled={field.archived}
            onChange={(event) => onChange({ ...field, helpText: event.target.value })}
          />
        </Field>
        <Field orientation="horizontal" data-disabled={field.archived || (eventHasResponses && !persisted)}>
          <Checkbox
            id={`field-${field.id}-required`}
            checked={field.required}
            disabled={field.archived || (eventHasResponses && !persisted)}
            onCheckedChange={(checked) => onChange({ ...field, required: checked === true })}
          />
          <FieldContent>
            <FieldLabel htmlFor={`field-${field.id}-required`} className="font-normal">Required</FieldLabel>
            {eventHasResponses && !persisted ? (
              <FieldDescription>New questions stay optional after responses exist.</FieldDescription>
            ) : null}
          </FieldContent>
        </Field>
        {isChoice ? <ChoiceEditor field={field} onChange={onChange} /> : null}
      </FieldGroup>
    </section>
  );
}

export function RegistrationFormBuilder({
  eventId,
  initialFields,
}: {
  eventId: string;
  initialFields: OrganizerRegistrationField[];
}) {
  const [fields, setFields] = useState(initialFields);
  const [state, formAction, isPending] = useActionState(
    saveRegistrationFormAction.bind(null, eventId),
    initialSaveRegistrationFormState,
  );
  const eventHasResponses = initialFields.some((field) => field.responseCount > 0);
  const persistedFieldIds = new Set(initialFields.map((field) => field.id));

  function updateField(nextField: OrganizerRegistrationField) {
    setFields((current) => current.map((field) => field.id === nextField.id ? nextField : field));
  }

  function moveField(index: number, offset: -1 | 1) {
    setFields((current) => {
      const next = [...current];
      const target = index + offset;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const definition = fields.map((field) => ({
    id: field.id,
    answerType: field.answerType,
    label: field.label,
    helpText: field.helpText,
    required: field.required,
    archived: field.archived,
    choices: field.choices,
  }));

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
      <form action={formAction} className="flex min-w-0 flex-col gap-5">
        <input type="hidden" name="definition" value={JSON.stringify(definition)} />
        {state.status !== "idle" ? (
          <Alert variant={state.status === "error" ? "destructive" : "default"}>
            {state.status === "success" ? <IconCheck /> : null}
            <AlertTitle>{state.status === "success" ? "Saved" : "Form not saved"}</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <section className="rounded-2xl border bg-muted/40 p-5 sm:p-6" aria-labelledby="built-in-heading">
          <h2 id="built-in-heading" className="font-medium">Built-in fields</h2>
          <p className="mt-1 text-support text-muted-foreground">
            Name and email are fixed, required, and cannot be reordered or archived.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-background px-4 py-3 text-sm font-medium">Name</div>
            <div className="rounded-xl border bg-background px-4 py-3 text-sm font-medium">Email</div>
          </div>
        </section>

        {fields.map((field, index) => (
          <FieldEditor
            key={field.id}
            field={field}
            index={index}
            total={fields.length}
            eventHasResponses={eventHasResponses}
            persisted={persistedFieldIds.has(field.id)}
            onChange={updateField}
            onMove={(offset) => moveField(index, offset)}
            onRemove={() => setFields((current) => current.filter((candidate) => candidate.id !== field.id))}
          />
        ))}

        <div className="flex flex-col gap-3 rounded-2xl border border-dashed p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-medium">Add an event-specific question</h2>
            <p className="mt-1 text-sm text-muted-foreground">You can configure its answer type after adding it.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => setFields((current) => [...current, newField("short_text")])}>
            <IconPlus data-icon="inline-start" />
            Add question
          </Button>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end border-t bg-background/95 py-4 backdrop-blur-sm">
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            {isPending ? "Saving…" : "Save form"}
          </Button>
        </div>
      </form>

      <RegistrationFormPreview fields={fields} />
    </div>
  );
}
