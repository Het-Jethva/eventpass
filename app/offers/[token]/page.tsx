import { notFound } from "next/navigation";
import { IconClock, IconTicket } from "@tabler/icons-react";

import { EventPassMark } from "@/components/eventpass-mark";
import { FormSubmitButton } from "@/components/form-submit-button";
import { PendingLink } from "@/components/pending-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { getAdmissionOfferView } from "@/features/tickets/server/tickets";
import { formatAdmissionOfferDeadline } from "@/lib/email/send-admission-offer";
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
    outcome !== "canceled" &&
    outcome !== "unavailable"
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
          {offer && !offer.suspended ? (
            <>
              <p className="text-sm font-medium text-muted-foreground">{offer.eventName}</p>
              <h1 className="mt-2 text-3xl font-headline text-balance">
                A place is ready for you
              </h1>
              <p className="mt-4 max-w-2xl text-muted-foreground">
                {offer.attendeeName}, you reached the front of the verified waitlist. Claiming
                claiming this offer confirms your registration and issues your ticket.
              </p>
              <Alert className="mt-8">
                <IconClock aria-hidden="true" />
                <AlertTitle>Time-limited offer</AlertTitle>
                <AlertDescription>
                  Claim by {formatAdmissionOfferDeadline(offer.expiresAt, offer.eventTimeZone)}.
                  After this deadline the place goes to the next person waiting.
                </AlertDescription>
              </Alert>
              <form action={claimAdmissionOfferAction.bind(null, token)} className="mt-8">
                <FormSubmitButton
                  size="lg"
                  pendingLabel="Issuing ticket"
                >
                  <IconTicket aria-hidden="true" />
                  Claim place and issue ticket
                </FormSubmitButton>
              </form>
            </>
          ) : offer?.suspended || outcome === "unavailable" ? (
            <>
              <h1 className="text-3xl font-headline text-balance">
                Event currently unavailable
              </h1>
              <p className="mt-4 text-muted-foreground">
                This Event is currently unavailable, so this offer cannot be
                claimed and no Ticket can be issued.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-headline text-balance">
                {outcome === "consumed"
                  ? "Offer already claimed"
                  : outcome === "canceled"
                    ? "Event canceled"
                    : "This offer has expired"}
              </h1>
              <p className="mt-4 text-muted-foreground">
                {outcome === "consumed"
                  ? "This private claim link has already been used. Open the ticket email that was sent after the claim."
                  : outcome === "canceled"
                    ? "This event was canceled, so the offer cannot be claimed and no ticket can be issued."
                    : "The claim deadline passed, so this registration expired and the place may have gone to the next person waiting."}
              </p>
            </>
          )}
          <PendingLink
            href={offer ? `/e/${offer.eventSlug}` : "/"}
            className={cn(buttonVariants({ variant: "outline" }), "mt-8")}
            pendingLabel="Opening event"
          >
            {offer ? "Return to event" : "Go to EventPass"}
          </PendingLink>
        </section>
      </main>
    </div>
  );
}
