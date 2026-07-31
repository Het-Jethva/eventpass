import Link from "next/link";
import { notFound } from "next/navigation";
import { IconClock, IconTicket } from "@tabler/icons-react";

import { EventPassMark } from "@/components/eventpass-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { getAdmissionOfferView } from "@/features/tickets/server/tickets";
import { cn } from "@/lib/utils";

import { claimAdmissionOfferAction } from "./actions";

export default async function AdmissionOfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const offer = await getAdmissionOfferView(token);
  const outcome = typeof query.outcome === "string" ? query.outcome : "";
  if (
    !offer &&
    outcome !== "expired" &&
    outcome !== "consumed" &&
    outcome !== "canceled"
  ) {
    notFound();
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
          {offer ? (
            <>
              <p className="text-sm font-medium text-muted-foreground">{offer.eventName}</p>
              <h1 className="mt-2 text-3xl font-headline text-balance">
                A place is ready for you
              </h1>
              <p className="mt-4 max-w-2xl text-muted-foreground">
                {offer.attendeeName}, you reached the front of the verified waitlist. Claiming
                this Admission Offer confirms your registration and issues your ticket.
              </p>
              <Alert className="mt-8">
                <IconClock aria-hidden="true" />
                <AlertTitle>Time-limited offer</AlertTitle>
                <AlertDescription>
                  Claim by {offer.expiresAt.toLocaleString("en", { timeZone: "UTC", timeZoneName: "short" })}.
                  After this deadline the place goes to the next person waiting.
                </AlertDescription>
              </Alert>
              <form action={claimAdmissionOfferAction.bind(null, token)} className="mt-8">
                <Button type="submit" size="lg">
                  <IconTicket aria-hidden="true" />
                  Claim place and issue ticket
                </Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-headline text-balance">
                {outcome === "consumed"
                  ? "Offer already claimed"
                  : outcome === "canceled"
                    ? "Event canceled"
                    : "Admission Offer expired"}
              </h1>
              <p className="mt-4 text-muted-foreground">
                {outcome === "consumed"
                  ? "This private claim link has already been used. Open the ticket email that was sent after the claim."
                  : outcome === "canceled"
                    ? "This Event was canceled, so the Admission Offer cannot be claimed and no ticket can be issued."
                    : "The claim deadline passed, so this registration expired and the place may have gone to the next person waiting."}
              </p>
            </>
          )}
          <Link
            href={offer ? `/e/${offer.eventSlug}` : "/"}
            className={cn(buttonVariants({ variant: "outline" }), "mt-8")}
          >
            {offer ? "Return to event" : "Go to EventPass"}
          </Link>
        </section>
      </main>
    </div>
  );
}
