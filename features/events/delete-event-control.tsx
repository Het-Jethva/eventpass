"use client";

import { IconTrash } from "@tabler/icons-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogSubmitAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DeleteEventControl({
  action,
  eventName,
}: {
  action: () => Promise<void>;
  eventName: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        <IconTrash data-icon="inline-start" />
        Delete draft
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {eventName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the empty draft and its staff
            assignments. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep draft</AlertDialogCancel>
          <form action={action}>
            <AlertDialogSubmitAction
              type="submit"
              variant="destructive"
              pendingLabel="Deleting draft"
            >
              <IconTrash data-icon="inline-start" />
              Delete draft
            </AlertDialogSubmitAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
