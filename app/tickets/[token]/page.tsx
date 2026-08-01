import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  IconCalendarEvent,
  IconMapPin,
  IconShieldCheck,
  IconTicketOff,
} from "@tabler/icons-react";
import QRCode from "qrcode";

import { EventPassMark } from "@/components/eventpass-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { formatTicketCode } from "@/features/tickets/ticket-code";
import { PrintTicketButton } from "@/features/tickets/print-ticket-button";
import { RegistrationManagementControls } from "@/features/tickets/registration-management-controls";
import { TicketStub } from "@/features/tickets/ticket-stub";
import { getManagementView } from "@/features/tickets/server/tickets";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Your ticket",
  robots: { index: false, follow: false },
};

function formatEventRange(startsAt: Date, endsAt: Date, timeZone: string) {
  // Components spelled out because `dateStyle`/`timeStyle` cannot be combined
  // with `timeZoneName`; the mix throws "Invalid option : option".
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).formatRange(startsAt, endsAt);
}

function formatCompactRange(startsAt: Date, endsAt: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
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
    <div className="flex min-h-svh flex-col bg-muted print:bg-background">
      <header className="border-b bg-background print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center px-4 sm:px-6">
          <EventPassMark />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10 print:max-w-none print:p-0">
        {management.event.suspended ? (
          <Alert variant="warning" className="print:hidden">
            <IconShieldCheck aria-hidden="true" />
            <AlertTitle>Event currently unavailable</AlertTitle>
            <AlertDescription>
              This Event is currently unavailable. Ticket and Registration
              information remains visible, but management actions are paused.
            </AlertDescription>
          </Alert>
        ) : null}

        {management.event.status === "canceled" ? (
          <Alert variant="destructive">
            <IconTicketOff aria-hidden="true" />
            <AlertTitle>This event was canceled</AlertTitle>
            <AlertDescription>
              {management.event.cancellationReason} This ticket is inactive and
              cannot be used for admission. Your registration is kept on record.
            </AlertDescription>
          </Alert>
        ) : null}

        {deliveryFailed ? (
          <Alert variant="warning" className="print:hidden">
            <IconShieldCheck aria-hidden="true" />
            <AlertTitle>
              Your ticket is ready, but the email was not accepted
            </AlertTitle>
            <AlertDescription>
              Save or print this page now. The confirmed registration and ticket
              remain valid.
            </AlertDescription>
          </Alert>
        ) : null}

        <TicketStub
          eventName={management.event.name}
          attendeeName={management.attendeeName}
          scheduleLabel={formatCompactRange(
            management.event.startsAt,
            management.event.endsAt,
            management.event.eventTimeZone,
          )}
          venueName={management.event.venueName}
          status={
            activeTicket
              ? {
                  label: `Registration ${management.registrationStatus}`,
                  variant: "success",
                }
              : {
                  label: `Ticket ${management.ticket?.status ?? "inactive"}`,
                  variant: "destructive",
                }
          }
          qrDataUrl={qrDataUrl}
          formattedCode={formattedCode}
          ticketCodeLabel={activeTicket?.code}
          action={activeTicket ? <PrintTicketButton /> : null}
          surroundClassName="bg-muted"
        />

        {/* Everything below the ticket is administration, not presentation. */}
        <section className="flex flex-col gap-5 border-t pt-8 print:hidden">
          <h2 className="text-lg font-medium">Event details</h2>
          <dl className="divide-y border-y">
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
                  Times shown in {management.event.eventTimeZone}
                </span>
              </dd>
            </div>
            <div className="grid gap-2 py-5 sm:grid-cols-[1.5rem_7rem_1fr]">
              <IconMapPin aria-hidden="true" className="mt-0.5" />
              <dt className="font-medium">Venue</dt>
              <dd className="text-muted-foreground">
                <span className="block text-foreground">
                  {management.event.venueName}
                </span>
                {management.event.venueAddress}
              </dd>
            </div>
          </dl>

          <Alert variant="info">
            <IconShieldCheck aria-hidden="true" />
            <AlertTitle>Keep this management link private</AlertTitle>
            <AlertDescription>
              It provides access to this registration. Share only the QR
              code or the ticket code when checking in.
            </AlertDescription>
          </Alert>

          <Link
            href={`/e/${management.event.slug}`}
            className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
          >
            View event
          </Link>
        </section>

        {activeTicket ? (
          <section className="border-t pt-8 print:hidden">
            <RegistrationManagementControls
              token={token}
              attendeeName={management.attendeeName}
              email={management.email}
              fields={management.fields}
              canEdit={management.canEdit}
              canReplaceOrCancel={management.canReplaceOrCancel}
              unavailable={management.event.suspended}
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}
