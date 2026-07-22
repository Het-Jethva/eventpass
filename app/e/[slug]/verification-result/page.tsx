import Link from "next/link";
import { notFound } from "next/navigation";
import { IconAlertTriangle, IconClockX, IconLinkOff, IconMailCheck } from "@tabler/icons-react";

import { EventPassMark } from "@/components/eventpass-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { getPublishedEvent } from "@/features/events/server/get-event";
import { cn } from "@/lib/utils";

const outcomes = {
  waitlisted: {
    icon: IconMailCheck,
    title: "You are on the waitlist",
    description:
      "Your email is verified and your FIFO position is established. We will email you a time-limited Admission Offer if a place becomes available.",
    success: true,
  },
  offered: {
    icon: IconMailCheck,
    title: "A place is available",
    description:
      "Capacity became available while you verified. Check your email for a time-limited Admission Offer and claim link.",
    success: true,
  },
  expired: {
    icon: IconClockX,
    title: "Verification link expired",
    description:
      "The 15-minute Capacity Hold has ended, so this Registration was not confirmed. Return to the Event to register again.",
    success: false,
  },
  consumed: {
    icon: IconLinkOff,
    title: "Verification link already used",
    description:
      "This single-use link has already confirmed a Registration. Open the Ticket email we sent, or contact the Event Organizer if you cannot find it.",
    success: false,
  },
  invalid: {
    icon: IconAlertTriangle,
    title: "Verification link is not valid",
    description:
      "The link may be incomplete or altered. Open the original email and try again, or return to the Event.",
    success: false,
  },
  mismatched: {
    icon: IconAlertTriangle,
    title: "Verification link does not match",
    description:
      "This link cannot confirm a place for this Event. Open the original email and use its complete link.",
    success: false,
  },
} as const;

export default async function VerificationResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const event = await getPublishedEvent(slug);
  const outcome = typeof query.outcome === "string" ? query.outcome : "";
  if (!event || !(outcome in outcomes)) notFound();

  const content = outcomes[outcome as keyof typeof outcomes];
  const Icon = content.icon;
  return (
    <div className="flex min-h-svh flex-col bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center px-4 sm:px-6">
          <EventPassMark />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-12 sm:px-6">
        <section className="w-full rounded-2xl border bg-background p-6 sm:p-10">
          <p className="text-sm font-medium text-muted-foreground">{event.name}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
            {content.success ? "Registration verified" : "Registration not confirmed"}
          </h1>
          <Alert variant={content.success ? "default" : "destructive"} className="mt-8">
            <Icon aria-hidden="true" />
            <AlertTitle>{content.title}</AlertTitle>
            <AlertDescription>{content.description}</AlertDescription>
          </Alert>
          <Link href={`/e/${slug}`} className={cn(buttonVariants(), "mt-8")}>
            Return to Event
          </Link>
        </section>
      </main>
    </div>
  );
}
