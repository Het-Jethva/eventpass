import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  IconCalendarEvent,
  IconMapPin,
  IconShieldCheck,
  IconTicket,
  IconTicketOff,
} from "@tabler/icons-react";
import QRCode from "qrcode";

import { EventPassMark } from "@/components/eventpass-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatTicketCode } from "@/features/tickets/ticket-code";
import { PrintTicketButton } from "@/features/tickets/print-ticket-button";
import { RegistrationManagementControls } from "@/features/tickets/registration-management-controls";
import { getManagementView } from "@/features/tickets/server/tickets";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Your Ticket",
  robots: { index: false, follow: false },
};

function formatEventRange(startsAt: Date, endsAt: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
    timeZoneName: "short",
  }).formatRange(startsAt, endsAt);
}

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const management = await getManagementView(token);
  if (!management) notFound();

  const activeTicket = management.ticket?.status === "active" ? management.ticket : null;
  const qrDataUrl = activeTicket
    ? await QRCode.toDataURL(activeTicket.signedPayload, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 480,
      })
    : null;
  const formattedCode = activeTicket ? formatTicketCode(activeTicket.code) : null;
  const deliveryFailed = query.delivery === "failed";

  return (
    <div className="flex min-h-svh flex-col bg-muted/20 print:bg-background">
      <header className="border-b bg-background print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center px-4 sm:px-6">
          <EventPassMark />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-12 print:max-w-none print:p-0">
        {management.event.status === "canceled" ? (
          <Alert variant="destructive" className="mb-6">
            <IconTicketOff aria-hidden="true" />
            <AlertTitle>This Event was canceled</AlertTitle>
            <AlertDescription>
              {management.event.cancellationReason} This Ticket is inactive
              and cannot be used for admission. Your Registration remains in
              history.
            </AlertDescription>
          </Alert>
        ) : null}
        {deliveryFailed ? (
          <Alert variant="destructive" className="mb-6 print:hidden">
            <IconShieldCheck aria-hidden="true" />
            <AlertTitle>Your Ticket is ready, but its email was not accepted</AlertTitle>
            <AlertDescription>
              Save or print this page now. The confirmed Registration and Ticket remain valid.
            </AlertDescription>
          </Alert>
        ) : null}

        <article className="overflow-hidden rounded-2xl border bg-background print:overflow-visible print:rounded-none">
          <header className="flex flex-col gap-4 border-b p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
            <div className="flex max-w-2xl flex-col gap-2">
              <Badge variant="secondary" className="w-fit">
                {management.registrationStatus === "confirmed" ? (
                  <IconShieldCheck aria-hidden="true" data-icon="inline-start" />
                ) : (
                  <IconTicketOff aria-hidden="true" data-icon="inline-start" />
                )}
                Registration {management.registrationStatus}
              </Badge>
              <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                {management.event.name}
              </h1>
              <p className="text-muted-foreground">Ticket for {management.attendeeName}</p>
            </div>
            <div className="flex gap-2 print:hidden">
              {activeTicket ? <PrintTicketButton /> : null}
            </div>
          </header>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="flex flex-col p-6 sm:p-8">
              <h2 className="text-lg font-semibold">Event details</h2>
              <dl className="mt-5 divide-y border-y">
                <div className="grid gap-2 py-5 sm:grid-cols-[1.5rem_7rem_1fr]">
                  <IconCalendarEvent aria-hidden="true" className="mt-0.5" />
                  <dt className="font-medium">Schedule</dt>
                  <dd className="text-muted-foreground">
                    {formatEventRange(
                      management.event.startsAt,
                      management.event.endsAt,
                      management.event.eventTimeZone,
                    )}
                    <span className="mt-1 block text-sm">
                      Event Time Zone: {management.event.eventTimeZone}
                    </span>
                  </dd>
                </div>
                <div className="grid gap-2 py-5 sm:grid-cols-[1.5rem_7rem_1fr]">
                  <IconMapPin aria-hidden="true" className="mt-0.5" />
                  <dt className="font-medium">Venue</dt>
                  <dd className="text-muted-foreground">
                    <span className="block text-foreground">{management.event.venueName}</span>
                    {management.event.venueAddress}
                  </dd>
                </div>
              </dl>

              <Alert className="mt-6 print:hidden">
                <IconShieldCheck aria-hidden="true" />
                <AlertTitle>Keep this management link private</AlertTitle>
                <AlertDescription>
                  It provides access to this Registration. Share only the QR representation or Ticket
                  Code when checking in.
                </AlertDescription>
              </Alert>

              <Link
                href={`/e/${management.event.slug}`}
                className={cn(buttonVariants({ variant: "outline" }), "mt-6 w-fit print:hidden")}
              >
                View Event
              </Link>

              {activeTicket ? (
                <div className="mt-10 border-t pt-8">
                  <RegistrationManagementControls
                    token={token}
                    attendeeName={management.attendeeName}
                    email={management.email}
                    fields={management.fields}
                    canEdit={management.canEdit}
                    canReplaceOrCancel={management.canReplaceOrCancel}
                  />
                </div>
              ) : (
                <Alert variant="destructive" className="mt-8 print:hidden">
                  <IconTicketOff aria-hidden="true" />
                  <AlertTitle>Ticket {management.ticket?.status ?? "inactive"}</AlertTitle>
                  <AlertDescription>
                    This Registration and Ticket remain in history, but the Ticket cannot be used for admission.
                  </AlertDescription>
                </Alert>
              )}
            </section>

            <section className="flex flex-col items-center border-t bg-muted/30 p-6 text-center lg:border-t-0 lg:border-l sm:p-8 print:border-l">
              {activeTicket && qrDataUrl && formattedCode ? (
                <>
                  <IconTicket aria-hidden="true" className="size-7" />
                  <Badge variant="secondary" className="mt-3">
                    <IconShieldCheck aria-hidden="true" data-icon="inline-start" />
                    Ticket active
                  </Badge>
                  <h2 className="mt-3 text-lg font-semibold">Present at check-in</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Show the QR representation or read out the Ticket Code.
                  </p>
                  <div className="mt-5 rounded-xl bg-white p-3">
                    <Image
                      src={qrDataUrl}
                      alt={`QR representation of Ticket ${formattedCode}`}
                      width={320}
                      height={320}
                      unoptimized
                      priority
                    />
                  </div>
                  <Separator className="my-6" />
                  <p className="text-sm font-medium text-muted-foreground">Ticket Code</p>
                  <p className="mt-2 font-mono text-2xl font-semibold tracking-[0.12em]" aria-label={activeTicket.code}>
                    {formattedCode}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Single entry · Valid only for this Event
                  </p>
                </>
              ) : (
                <>
                  <IconTicketOff aria-hidden="true" className="size-8" />
                  <h2 className="mt-3 text-lg font-semibold">Ticket inactive</h2>
                  <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                    The previous Ticket is retained in history and cannot be presented for admission.
                  </p>
                </>
              )}
            </section>
          </div>
        </article>
      </main>
    </div>
  );
}
