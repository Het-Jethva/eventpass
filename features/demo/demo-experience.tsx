"use client";

import { useState } from "react";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCircleCheck,
  IconCloudUpload,
  IconCopyCheck,
  IconRotate,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScanOutcome } from "@/features/admission/scan-outcome";
import {
  getAuditEntries,
  getDashboardStats,
  getRecentScans,
  SAMPLE_EVENT,
} from "@/features/demo/demo-sample";
import { formatTicketCode } from "@/features/tickets/ticket-code";
import { TicketStub } from "@/features/tickets/ticket-stub";
import { cn } from "@/lib/utils";

const STEPS = ["Register", "Dashboard", "Door"] as const;

const SCAN_ICONS = {
  success: IconCircleCheck,
  provisional: IconCloudUpload,
  warning: IconCopyCheck,
} as const;

function StepDots({
  step,
  onSelect,
}: {
  step: number;
  onSelect: (next: number) => void;
}) {
  return (
    <ol className="flex items-center gap-2" aria-label="Demo steps">
      {STEPS.map((label, index) => (
        <li key={label} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelect(index)}
            aria-current={index === step ? "step" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
              index === step
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {index + 1}. {label}
          </button>
        </li>
      ))}
    </ol>
  );
}

export function DemoExperience({ qrDataUrl }: { qrDataUrl: string }) {
  const [step, setStep] = useState(0);
  const [guestName, setGuestName] = useState<string>(SAMPLE_EVENT.attendeeName);
  const [registered, setRegistered] = useState(false);
  const [admitted, setAdmitted] = useState(false);
  const [offlineShown, setOfflineShown] = useState(false);

  const displayName =
    guestName.trim().length > 0 ? guestName.trim() : SAMPLE_EVENT.attendeeName;
  const stats = getDashboardStats({ registered, admitted });
  const scans = getRecentScans({ registered, admitted, offlineShown });
  const audit = getAuditEntries({ registered, admitted, offlineShown });
  const code = SAMPLE_EVENT.ticketCode.replace("-", "");

  function reset() {
    setStep(0);
    setGuestName(SAMPLE_EVENT.attendeeName);
    setRegistered(false);
    setAdmitted(false);
    setOfflineShown(false);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepDots step={step} onSelect={setStep} />
        <Button variant="ghost" size="sm" type="button" onClick={reset}>
          <IconRotate data-icon="inline-start" />
          Start over
        </Button>
      </div>

      {step === 0 ? (
        <section
          aria-labelledby="demo-register-heading"
          className="grid gap-6 lg:grid-cols-2 lg:items-start"
        >
          <div className="flex flex-col gap-4">
            <h2
              id="demo-register-heading"
              className="text-2xl font-headline text-balance sm:text-3xl"
            >
              Register as a guest
            </h2>
            <p className="text-base text-muted-foreground">
              No account, no sign-in. In production this reserves a place for
              15 minutes and verifies by email. Here verification is skipped
              and nothing leaves the browser.
            </p>
            <form
              className="flex flex-col gap-4 rounded-xl border bg-card p-5"
              onSubmit={(event) => {
                event.preventDefault();
                setRegistered(true);
              }}
            >
              <Field>
                <FieldLabel htmlFor="demo-name">Full name</FieldLabel>
                <Input
                  id="demo-name"
                  name="name"
                  autoComplete="name"
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  maxLength={80}
                />
                <FieldDescription>
                  Sample only. Editing the name updates the ticket below.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="demo-email">Email</FieldLabel>
                <Input
                  id="demo-email"
                  name="email"
                  type="email"
                  value={SAMPLE_EVENT.attendeeEmail}
                  disabled
                />
                <FieldDescription>
                  Fixed in the demo. Production sends a verification link.
                </FieldDescription>
              </Field>
              <Button type="submit" disabled={registered}>
                {registered ? "Registered" : "Register in the demo"}
                <IconArrowRight data-icon="inline-end" />
              </Button>
              {registered ? (
                <p className="text-sm text-muted-foreground" role="status">
                  Registered locally. Continue to the dashboard to see the
                  count move.
                </p>
              ) : null}
            </form>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setStep(1)}
                disabled={!registered}
              >
                Continue to dashboard
                <IconArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <TicketStub
              eventName={SAMPLE_EVENT.name}
              attendeeName={displayName}
              scheduleLabel={SAMPLE_EVENT.schedule}
              venueName={SAMPLE_EVENT.venue}
              status={
                registered
                  ? { label: "Registered", variant: "success" }
                  : { label: "Sample", variant: "warning" }
              }
              qrDataUrl={qrDataUrl}
              formattedCode={formatTicketCode(code)}
              ticketCodeLabel={code}
              surroundClassName="bg-background"
              titleAs="h3"
            />
            <p className="text-xs text-muted-foreground">
              Example ticket. The code shown is not valid for any event.
            </p>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section
          aria-labelledby="demo-dashboard-heading"
          className="flex flex-col gap-6"
        >
          <div className="flex max-w-2xl flex-col gap-3">
            <h2
              id="demo-dashboard-heading"
              className="text-2xl font-headline text-balance sm:text-3xl"
            >
              Watch the operations dashboard
            </h2>
            <p className="text-base text-muted-foreground">
              The organizer sees arrivals, capacity, and an audit history
              nobody can edit. Registering above adds one row here and one
              audit entry. Refresh and it is gone.
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-5 rounded-xl border bg-card p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Arrivals</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {stats.checkedInCount} of {stats.registeredCount}{" "}
                    registered · {stats.remaining} places left of{" "}
                    {SAMPLE_EVENT.capacity}
                  </p>
                </div>
                <p className="font-mono text-2xl font-medium">
                  {stats.percent}%
                </p>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Demo arrivals"
                aria-valuemin={0}
                aria-valuemax={SAMPLE_EVENT.capacity}
                aria-valuenow={stats.checkedInCount}
              >
                <div
                  className="h-full rounded-full bg-foreground"
                  style={{
                    width: `${(stats.checkedInCount / SAMPLE_EVENT.capacity) * 100}%`,
                  }}
                />
              </div>
              <div>
                <p className="text-sm font-medium">Recent scans</p>
                <ul className="mt-3 divide-y rounded-lg border">
                  {scans.map((scan) => {
                    const Icon = SCAN_ICONS[scan.variant];
                    return (
                      <li
                        key={scan.id}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <Icon
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {scan.name}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {scan.code} · {scan.time}
                          </p>
                        </div>
                        <Badge variant={scan.variant}>{scan.label}</Badge>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <div className="flex flex-col gap-5 rounded-xl border bg-card p-5">
              <div>
                <p className="text-sm font-medium">Audit history</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Every change keeps its actor, time, and reason.
                </p>
              </div>
              <ul className="flex flex-col gap-3">
                {audit.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-lg border bg-background px-4 py-3"
                  >
                    <p className="font-mono text-xs text-muted-foreground">
                      {entry.time}
                    </p>
                    <p className="mt-1 text-sm">{entry.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" type="button" onClick={() => setStep(0)}>
              <IconArrowLeft data-icon="inline-start" />
              Back to register
            </Button>
            <Button type="button" onClick={() => setStep(2)}>
              Open the door scanner
              <IconArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section
          aria-labelledby="demo-door-heading"
          className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start"
        >
          <div className="flex max-w-2xl flex-col gap-4">
            <h2
              id="demo-door-heading"
              className="text-2xl font-headline text-balance sm:text-3xl"
            >
              Scan at the door
            </h2>
            <p className="text-base text-muted-foreground">
              One scan, one clear answer. With a signal the check-in settles
              at once. Without one it is held on the phone and shown as
              unconfirmed until it reconciles. EventPass never colours those
              the same.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => setAdmitted(true)}
                disabled={admitted}
              >
                <IconCircleCheck data-icon="inline-start" />
                {admitted ? "Admitted" : "Scan online ticket"}
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => setOfflineShown(true)}
                disabled={offlineShown}
              >
                <IconCloudUpload data-icon="inline-start" />
                {offlineShown ? "Offline saved" : "Simulate offline scan"}
              </Button>
            </div>
            {admitted || offlineShown ? (
              <p className="text-sm text-muted-foreground" role="status">
                {admitted && offlineShown
                  ? "Both outcomes are on screen. Compare the colour, the qualifier, and the instruction."
                  : admitted
                    ? "Accepted. The dashboard arrivals count includes this scan."
                    : "Provisional. Saved on this phone, reconciles after reconnect — conflicts stay visible."}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {registered
                  ? "Tip: scan the ticket from step one."
                  : "Tip: you skipped registration — the scanner still works, the dashboard just will not show your name yet."}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setStep(1)}
              >
                <IconArrowLeft data-icon="inline-start" />
                Back to dashboard
              </Button>
            </div>
          </div>
          <div className="mx-auto w-full max-w-sm">
            <div className="overflow-hidden rounded-xl border bg-background">
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <p className="text-sm font-medium">{SAMPLE_EVENT.entrance}</p>
                <Badge variant={offlineShown ? "provisional" : "success"}>
                  {offlineShown ? "Offline" : "Online"}
                </Badge>
              </div>
              {offlineShown ? (
                <ScanOutcome
                  outcome="provisional"
                  attendeeName="Dev Patel"
                  ticketCode="2BN6D–T8W4R"
                  titleAs="p"
                  className="min-h-96 justify-start py-10"
                />
              ) : (
                <ScanOutcome
                  outcome={admitted ? "accepted" : "accepted"}
                  attendeeName={admitted ? displayName : SAMPLE_EVENT.attendeeName}
                  ticketCode="7QM4X–K3B9T"
                  titleAs="p"
                  reserveQualifier
                  className="min-h-96 justify-start py-10"
                />
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Example guest. Held on this phone until it reconnects.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
