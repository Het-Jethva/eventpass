"use client";

import { FormEvent, useId, useState } from "react";
import { IconAlertTriangle, IconRotate } from "@tabler/icons-react";

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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type ActionResult =
  | { outcome: "completed" | "reversed" }
  | { outcome: "error"; message: string };

export function ReasonedCheckInAction({
  label,
  title,
  description,
  reasonDescription,
  action,
  onCompleted,
  variant = "outline",
}: {
  label: string;
  title: string;
  description: string;
  reasonDescription: string;
  action: (reason: string) => Promise<ActionResult>;
  onCompleted?: () => void;
  variant?: "outline" | "destructive";
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const reasonId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedReason = reason.trim();
    if (!normalizedReason || pending) return;
    setPending(true);
    setError(null);
    const result = await action(normalizedReason);
    setPending(false);
    if (result.outcome === "error") {
      setError(result.message);
      return;
    }
    setOpen(false);
    setReason("");
    onCompleted?.();
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending) return;
        setOpen(nextOpen);
        if (!nextOpen) setError(null);
      }}
    >
      <AlertDialogTrigger render={<Button variant={variant} />}>
        <IconRotate data-icon="inline-start" />
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form onSubmit={submit} className="contents">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor={reasonId}>Reason</FieldLabel>
            <Textarea
              id={reasonId}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              minLength={1}
              maxLength={500}
              autoFocus
              placeholder="Record why this correction is necessary."
            />
            <FieldDescription>{reasonDescription}</FieldDescription>
          </Field>
          {error ? (
            <Alert variant="destructive" aria-live="assertive">
              <IconAlertTriangle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep Check-in</AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              variant={variant}
              disabled={pending || !reason.trim()}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {pending ? "Saving…" : label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
