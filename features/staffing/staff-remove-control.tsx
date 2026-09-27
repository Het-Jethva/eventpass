"use client";

import { IconUserMinus } from "@tabler/icons-react";

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

export function StaffRemoveControl({
  action,
  name,
}: {
  action: () => Promise<void>;
  name: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button size="sm" variant="outline" />}>
        <IconUserMinus data-icon="inline-start" />
        Remove
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Their access to this event ends immediately. The removal remains in
            the permanent record.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep access</AlertDialogCancel>
          <form action={action}>
            <AlertDialogSubmitAction
              type="submit"
              variant="destructive"
              pendingLabel="Removing access"
            >
              Remove access
            </AlertDialogSubmitAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
