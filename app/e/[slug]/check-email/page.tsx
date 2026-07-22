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
  if (!event || (query.outcome !== "hold" && query.outcome !== "waitlist")) {
    notFound();
  }

  const hasCapacityHold = query.outcome === "hold";
  const deliveryFailed = query.delivery === "failed";

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
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Check your email
          </h1>
          <p className="mt-4 max-w-xl leading-7 text-muted-foreground">
            Use the single-use link we sent to verify your email address and
            continue your Registration.
          </p>

          <Alert className="mt-8">
            <IconClock aria-hidden="true" />
            <AlertTitle>
              {hasCapacityHold
                ? "Your place is held for 15 minutes"
                : "No place is being held"}
            </AlertTitle>
            <AlertDescription>
              {hasCapacityHold
                ? "Verify before the link expires to claim this place. The Registration is not confirmed yet."
                : "The Event is currently full. Verify your email to join the waitlist; priority begins only after successful verification."}
            </AlertDescription>
          </Alert>

          {deliveryFailed ? (
            <Alert variant="destructive" className="mt-4">
              <IconAlertTriangle aria-hidden="true" />
              <AlertTitle>Email delivery was not accepted</AlertTitle>
              <AlertDescription>
                Your unconfirmed Registration was saved, but the provider did not
                accept the email. Please contact the Event Organizer.
              </AlertDescription>
            </Alert>
          ) : null}

          <Link
            href={`/e/${slug}`}
            className={cn(buttonVariants({ variant: "outline" }), "mt-8")}
          >
            Return to Event
          </Link>
        </section>
      </main>
    </div>
  );
}
