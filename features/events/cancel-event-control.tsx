"use client";

import { IconBan } from "@tabler/icons-react";

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
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export function CancelEventControl({
  action,
  eventName,
}: {
  action: (formData: FormData) => Promise<void>;
  eventName: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        <IconBan data-icon="inline-start" />
        Cancel event
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel {eventName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This immediately invalidates every active ticket and blocks new
            Registration and admission. Records are preserved, and the event
            cannot be restored.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={action} className="grid gap-5">
          <Field>
            <FieldLabel htmlFor="cancellation-reason">
              Cancellation reason
            </FieldLabel>
            <Textarea
              id="cancellation-reason"
              name="reason"
              maxLength={1_000}
              rows={4}
              required
              placeholder="Explain the cancellation to attendees and staff."
            />
            <FieldDescription>
              This reason is recorded in Audit and shared with affected
              Attendees.
            </FieldDescription>
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep event</AlertDialogCancel>
            <AlertDialogAction type="submit" variant="destructive">
              <IconBan data-icon="inline-start" />
              Cancel event permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
