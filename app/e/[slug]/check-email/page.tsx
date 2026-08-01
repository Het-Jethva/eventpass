import Link from "next/link";
import { notFound } from "next/navigation";
import { IconAlertTriangle, IconClock, IconMailCheck } from "@tabler/icons-react";

import { EventPassMark } from "@/components/eventpass-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { getPublishedEvent } from "@/features/events/server/get-event";
import { cn } from "@/lib/utils";

export default async function RegistrationCheckEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const event = await getPublishedEvent(slug);
  const outcome =
    typeof query.outcome === "string" &&
    ["hold", "waitlist", "neutral"].includes(query.outcome)
      ? query.outcome
      : null;
  if (!event || !outcome) {
    notFound();
  }

  const isNeutral = outcome === "neutral";
  const hasCapacityHold = outcome === "hold";
  const deliveryFailed = !isNeutral && query.delivery === "failed";

  return (
    <div className="flex min-h-svh flex-col bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center px-4 sm:px-6">
          <EventPassMark />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-12 sm:px-6">
        <section className="w-full rounded-2xl border bg-background p-6 sm:p-10">
          <IconMailCheck aria-hidden="true" className="size-10" />
          <p className="mt-6 text-sm font-medium text-muted-foreground">
            {event.name}
          </p>
          <h1 className="mt-2 text-3xl font-headline">
            Check your email
          </h1>
          <p className="mt-4 max-w-xl text-reading text-muted-foreground">
            {isNeutral
              ? "If your Registration can be processed, we’ll send a single-use verification link shortly."
              : "Use the single-use link we sent to verify your email address and continue your registration."}
          </p>

          {isNeutral ? (
            <Alert className="mt-8">
              <IconClock aria-hidden="true" />
              <AlertTitle>Check your inbox</AlertTitle>
              <AlertDescription>
                If you submitted a Registration, the next steps will be in the
                email. If you did not, you can ignore this message.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="mt-8">
              <IconClock aria-hidden="true" />
              <AlertTitle>
                {hasCapacityHold
                  ? "Your place is held for 15 minutes"
                  : "No place is being held"}
              </AlertTitle>
              <AlertDescription>
                {hasCapacityHold
                  ? "Verify before the link expires to claim this place. Your registration is not confirmed yet."
                  : "The event is full. Verify your email to join the waitlist; your place in line starts once you do."}
              </AlertDescription>
            </Alert>
          )}

          {deliveryFailed ? (
            <Alert variant="destructive" className="mt-4">
              <IconAlertTriangle aria-hidden="true" />
              <AlertTitle>Email delivery was not accepted</AlertTitle>
              <AlertDescription>
                Your unconfirmed registration was saved, but the provider did not
                accept the email. Contact the organizer.
              </AlertDescription>
            </Alert>
          ) : null}

          <Link
            href={`/e/${slug}`}
            className={cn(buttonVariants({ variant: "outline" }), "mt-8")}
          >
            Return to event
          </Link>
        </section>
      </main>
    </div>
  );
}
