import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconMailCheck } from "@tabler/icons-react";

import { PublicAuthShell } from "@/components/public-auth-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { STAFF_MAGIC_LINK_CONSUME_PARAM } from "@/features/staff-identity/magic-link-policy";


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
        <form action="/api/auth/magic-link/verify" method="get">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="callbackURL" value={callbackURL} />
          <input
            type="hidden"
            name="errorCallbackURL"
            value="/sign-in?error=invalid-link"
          />
          <input type="hidden" name={STAFF_MAGIC_LINK_CONSUME_PARAM} value="1" />
          <Button type="submit" size="lg" className="h-11 w-full">
            Sign in to EventPass
          </Button>
        </form>
      </div>
    </PublicAuthShell>
  );
}
