"use client";

import { useState } from "react";
import { IconAlertTriangle, IconShieldCheck } from "@tabler/icons-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

interface AdminActionDialogProps {
  title: string;
  description: string;
  actionLabel: string;
  isDestructive?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

/**
 * Privileged administrator actions, gated behind a reason that is kept forever.
 *
 * This used to be a hand-rolled fixed-position div: no focus trap, no Escape,
 * no restore of focus on close, a scrim picked outside the palette, and a bare
 * textarea with a focus ring unlike every other field in the product. Also —
 * against the
 * system's own rule — the *tinted* destructive variant on the confirm, which is
 * the variant reserved for the trigger. It is the same dialog now, built from
 * the primitives that already solved all of that.
 */
export function AdminActionDialog({
  title,
  description,
  actionLabel,
  isDestructive = false,
  isOpen,
  onClose,
  onConfirm,
}: AdminActionDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(submitEvent: React.FormEvent) {
    submitEvent.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("A reason is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(trimmed);
      setReason("");
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Something went wrong.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <AlertDialogContent>
        <form onSubmit={handleSubmit} className="grid gap-6">
          <AlertDialogHeader>
            <AlertDialogMedia
              className={
                isDestructive
                  ? "bg-destructive-subtle text-destructive-text"
                  : "bg-info-subtle text-info-text"
              }
            >
              {isDestructive ? (
                <IconAlertTriangle aria-hidden="true" />
              ) : (
                <IconShieldCheck aria-hidden="true" />
              )}
            </AlertDialogMedia>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>

          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor="admin-reason-input">Reason</FieldLabel>
            <Textarea
              id="admin-reason-input"
              name="reason"
              rows={3}
              value={reason}
              onChange={(changeEvent) => {
                setReason(changeEvent.target.value);
                if (error) setError(null);
              }}
              placeholder="Why is this action being taken?"
              aria-invalid={Boolean(error)}
              aria-describedby="admin-reason-help"
              disabled={isSubmitting}
              required
            />
            <FieldDescription id="admin-reason-help">
              Kept permanently against your account.
            </FieldDescription>
            <FieldError>{error}</FieldError>
          </Field>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <Button
              type="submit"
              variant={isDestructive ? "destructive-solid" : "default"}
              disabled={isSubmitting || !reason.trim()}
            >
              {isSubmitting ? <Spinner /> : null}
              {actionLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
