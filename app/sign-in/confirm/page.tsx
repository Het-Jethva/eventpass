import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconMailCheck } from "@tabler/icons-react";

import { FormSubmitButton } from "@/components/form-submit-button";
import { PublicAuthShell } from "@/components/public-auth-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { confirmStaffMagicLinkAction } from "./actions";

export const metadata: Metadata = {
  title: "Confirm sign-in",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function ConfirmStaffMagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  const requestedCallback =
    typeof query.callbackURL === "string" ? query.callbackURL : "/events";
  const callbackURL =
    requestedCallback.startsWith("/") && !requestedCallback.startsWith("//")
      ? requestedCallback
      : "/events";
  if (!token) notFound();

  return (
    <PublicAuthShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-headline text-balance">
            Confirm your sign-in
          </h1>
          <p className="max-w-sm text-reading text-muted-foreground text-pretty">
            Confirming uses this one-time link and opens your staff workspace.
          </p>
        </div>
        <Alert>
          <IconMailCheck aria-hidden="true" />
          <AlertTitle>Ready to confirm</AlertTitle>
          <AlertDescription>
            If you did not request this sign-in link, close this page.
          </AlertDescription>
        </Alert>
        <form action={confirmStaffMagicLinkAction.bind(null, token, callbackURL)}>
          <FormSubmitButton size="lg" className="h-11 w-full" pendingLabel="Signing in">
            Sign in to EventPass
          </FormSubmitButton>
        </form>
      </div>
    </PublicAuthShell>
  );
}
