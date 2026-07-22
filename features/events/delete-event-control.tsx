"use client";

import { IconTrash } from "@tabler/icons-react";

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
        Delete Draft Event
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {eventName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the empty Draft Event and its Event Staff
            assignments. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Draft Event</AlertDialogCancel>
          <form action={action}>
            <AlertDialogAction type="submit" variant="destructive">
              <IconTrash data-icon="inline-start" />
              Delete Draft Event
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
