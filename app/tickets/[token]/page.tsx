import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  IconCalendarEvent,
  IconMapPin,
  IconShieldCheck,
  IconTicket,
} from "@tabler/icons-react";
import QRCode from "qrcode";

import { EventPassMark } from "@/components/eventpass-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatTicketCode } from "@/features/tickets/ticket-code";
import { PrintTicketButton } from "@/features/tickets/print-ticket-button";
import { getTicketView } from "@/features/tickets/server/tickets";
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
  const ticket = await getTicketView(token);
  if (!ticket) notFound();

  const qrDataUrl = await QRCode.toDataURL(ticket.ticketJws, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 480,
  });
  const formattedCode = formatTicketCode(ticket.ticketCode);
  const deliveryFailed = query.delivery === "failed";

  return (
    <div className="flex min-h-svh flex-col bg-muted/20 print:bg-background">
      <header className="border-b bg-background print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center px-4 sm:px-6">
          <EventPassMark />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:px-6 sm:py-12 print:max-w-none print:p-0">
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
                <IconShieldCheck aria-hidden="true" data-icon="inline-start" />
                Registration confirmed
              </Badge>
              <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                {ticket.event.name}
              </h1>
              <p className="text-muted-foreground">Ticket for {ticket.attendeeName}</p>
            </div>
            <div className="flex gap-2 print:hidden">
              <PrintTicketButton />
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
                      ticket.event.startsAt,
                      ticket.event.endsAt,
                      ticket.event.eventTimeZone,
                    )}
                    <span className="mt-1 block text-sm">
                      Event Time Zone: {ticket.event.eventTimeZone}
                    </span>
                  </dd>
                </div>
                <div className="grid gap-2 py-5 sm:grid-cols-[1.5rem_7rem_1fr]">
                  <IconMapPin aria-hidden="true" className="mt-0.5" />
                  <dt className="font-medium">Venue</dt>
                  <dd className="text-muted-foreground">
                    <span className="block text-foreground">{ticket.event.venueName}</span>
                    {ticket.event.venueAddress}
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
                href={`/e/${ticket.event.slug}`}
                className={cn(buttonVariants({ variant: "outline" }), "mt-6 w-fit print:hidden")}
              >
                View Event
              </Link>
            </section>

            <section className="flex flex-col items-center border-t bg-muted/30 p-6 text-center lg:border-t-0 lg:border-l sm:p-8 print:border-l">
              <IconTicket aria-hidden="true" className="size-7" />
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
              <p className="mt-2 font-mono text-2xl font-semibold tracking-[0.12em]" aria-label={ticket.ticketCode}>
                {formattedCode}
              </p>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Single entry · Valid only for this Event
              </p>
            </section>
          </div>
        </article>
      </main>
    </div>
  );
}
