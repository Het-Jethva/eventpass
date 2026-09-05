import { redirect } from "next/navigation";
import { IconMailCheck } from "@tabler/icons-react";

import { EventPassMark } from "@/components/eventpass-mark";
import { FormSubmitButton } from "@/components/form-submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { inspectRegistrationVerification } from "@/features/tickets/server/tickets";

import { confirmRegistrationVerificationAction } from "./actions";

export default async function ConfirmRegistrationVerificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const token = typeof query.token === "string" ? query.token : "";
  const inspection = await inspectRegistrationVerification(slug, token);

  if (inspection.outcome !== "pending") {
    redirect(
      `/e/${encodeURIComponent(slug)}/verification-result?outcome=${inspection.outcome}`,
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center px-4 sm:px-6">
          <EventPassMark />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-12 sm:px-6">
        <section className="w-full rounded-2xl border bg-background p-6 sm:p-10">
          <p className="text-sm font-medium text-muted-foreground">
            {inspection.eventName}
          </p>
          <h1 className="mt-2 text-3xl font-headline text-balance">
            Confirm your email
          </h1>
          <p className="mt-4 max-w-xl text-reading text-muted-foreground">
            Confirming verifies this address and continues your registration for
            this event. This step is required once and cannot be undone from here.
          </p>
          <Alert className="mt-8">
            <IconMailCheck aria-hidden="true" />
            <AlertTitle>Ready to confirm</AlertTitle>
            <AlertDescription>
              If you did not register for this event, close this page. Confirming
              uses the single-use link from your email.
            </AlertDescription>
          </Alert>
          <form
            action={confirmRegistrationVerificationAction.bind(null, slug, token)}
            className="mt-8"
          >
            <FormSubmitButton size="lg" pendingLabel="Confirming">
              Confirm my email
            </FormSubmitButton>
          </form>
        </section>
      </main>
    </div>
  );
}
