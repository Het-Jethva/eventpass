"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCircleCheck,
  IconCloudUpload,
  IconCopyCheck,
  IconRotate,
  IconQrcode,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { ScanOutcome } from "@/features/admission/scan-outcome";
import {
  getAuditEntries,
  getDashboardStats,
  getRecentScans,
  SAMPLE_EVENT,
  type DemoScanState,
} from "@/features/demo/demo-sample";
import { formatTicketCode } from "@/features/tickets/ticket-code";
import { TicketStub } from "@/features/tickets/ticket-stub";
import { cn } from "@/lib/utils";

const STEPS = ["Register", "Dashboard", "Door"] as const;
const subscribeToInteractivity = () => () => {};

const SCAN_ICONS = {
  success: IconCircleCheck,
  provisional: IconCloudUpload,
  warning: IconCopyCheck,
} as const;

function StepDots({
  step,
  onSelect,
  disabled,
}: {
  step: number;
  onSelect: (next: number) => void;
  disabled: boolean;
}) {
  return (
    <ol className="flex items-center gap-2" aria-label="Demo steps">
      {STEPS.map((label, index) => (
        <li key={label} className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(index)}
            aria-current={index === step ? "step" : undefined}
            className={cn(
              "min-h-11 rounded-md px-3 py-2 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
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
  const interactive = useSyncExternalStore(
    subscribeToInteractivity,
    () => true,
    () => false,
  );
  const [step, setStep] = useState(0);
  const [guestName, setGuestName] = useState<string>(SAMPLE_EVENT.attendeeName);
  const [registered, setRegistered] = useState(false);
  const [scan, setScan] = useState<DemoScanState>({ kind: "ready" });
  const sectionRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const displayName =
    guestName.trim().length > 0 ? guestName.trim() : SAMPLE_EVENT.attendeeName;
  const admitted = scan.kind === "online" || scan.kind === "synced";
  const stats = getDashboardStats({ registered, admitted });
  const scans = getRecentScans({
    guestName: displayName,
    scan,
  });
  const audit = getAuditEntries({
    guestName: displayName,
    registered,
    scan,
  });
  const code = SAMPLE_EVENT.ticketCode.replace("-", "");

  function showScan(next: DemoScanState) {
    setScan(next);
    requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 639px)").matches) {
        resultRef.current?.scrollIntoView({ block: "start" });
      }
    });
  }

  function selectStep(next: number) {
    setStep(next);
    requestAnimationFrame(() => {
      const heading = sectionRef.current?.querySelector<HTMLElement>("h2");
      heading?.focus({ preventScroll: true });
      sectionRef.current?.scrollIntoView({ block: "start" });
    });
  }

  function reset() {
    setStep(0);
    setGuestName(SAMPLE_EVENT.attendeeName);
    setRegistered(false);
    setScan({ kind: "ready" });
  }

  return (
    <div
      ref={sectionRef}
      className="demo-experience flex scroll-mt-20 flex-col gap-6 [&_h2]:scroll-mt-24 [&_h2]:outline-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepDots step={step} onSelect={selectStep} disabled={!interactive} />
        <Button
          variant="ghost"
          size="sm"
          type="button"
          disabled={!interactive}
          onClick={reset}
        >
          <IconRotate data-icon="inline-start" />
          <span className="sr-only sm:not-sr-only">Start over</span>
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
              tabIndex={-1}
              className="text-2xl font-headline text-balance sm:text-3xl"
            >
              {registered ? "Your sample ticket" : "Register as a guest"}
            </h2>
            <p className="text-base text-muted-foreground">
              {registered
                ? "See how this registration appears to the organizer next."
                : "Enter a name to create a ticket for the Robotics Society Winter Showcase."}
            </p>
            <form
              className={cn(
                "flex flex-col gap-4",
                !registered && "rounded-xl border bg-card p-5",
              )}
              onSubmit={(event) => {
                event.preventDefault();
                setRegistered(true);
              }}
            >
              {registered ? (
                <Alert>
                  <IconCircleCheck aria-hidden="true" />
                  <AlertTitle>Your sample ticket is ready</AlertTitle>
                  <AlertDescription>
                    {displayName} is registered. Email verification is skipped
                    in this demo.
                  </AlertDescription>
                </Alert>
              ) : (
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="demo-name">Full name</FieldLabel>
                    <Input
                      id="demo-name"
                      disabled={!interactive}
                      name="name"
                      autoComplete="name"
                      value={guestName}
                      onChange={(event) => setGuestName(event.target.value)}
                      maxLength={80}
                      required
                      pattern=".*\S.*"
                      readOnly={registered}
                    />
                  </Field>
                  <p className="text-sm text-muted-foreground">
                    Email verification is skipped here. At a real event, guests
                    confirm by email before receiving their ticket.
                  </p>
                </FieldGroup>
              )}
              <Button
                disabled={!interactive}
                type={registered ? "button" : "submit"}
                onClick={registered ? () => selectStep(1) : undefined}
              >
                {!interactive
                  ? "Loading demo…"
                  : registered
                    ? "Continue to dashboard"
                    : "Register in the demo"}
                <IconArrowRight data-icon="inline-end" />
              </Button>
            </form>
          </div>
          <div className={cn("flex flex-col gap-3", !registered && "hidden lg:flex")}>
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
              tabIndex={-1}
              className="text-2xl font-headline text-balance sm:text-3xl"
            >
              Watch the operations dashboard
            </h2>
            <p className="text-base text-muted-foreground">
              {registered
                ? `${displayName} has a ticket. `
                : "This sample event is already taking arrivals. "}
              See the guest count and activity here, then try a scan at the
              door.
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-5 rounded-xl border bg-card p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Arrivals</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {stats.checkedInCount} of {stats.registeredCount} registered
                    guests
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-medium tabular-nums">
                    {stats.percent}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    of venue capacity
                  </p>
                </div>
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
              <p className="text-sm text-muted-foreground">
                {stats.remaining} registration places available of{" "}
                {SAMPLE_EVENT.capacity} total.
              </p>
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
                  A timeline of registrations, check-ins, and event updates.
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
            <Button
              variant="outline"
              type="button"
              onClick={() => selectStep(0)}
            >
              <IconArrowLeft data-icon="inline-start" />
              Back to register
            </Button>
            <Button type="button" onClick={() => selectStep(2)}>
              Open the door scanner
              <IconArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section
          aria-labelledby="demo-door-heading"
          className="grid gap-6 lg:grid-cols-[1fr_25rem] lg:items-start"
        >
          <div className="flex max-w-2xl flex-col gap-4">
            <h2
              id="demo-door-heading"
              tabIndex={-1}
              className="text-2xl font-headline text-balance sm:text-3xl"
            >
              Scan at the door
            </h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Scan {displayName}’s sample ticket. Try going offline, then reconnect
              to see the arrival confirmed. No camera needed.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => {
                  showScan(scan.kind === "ready"
                    ? { kind: "online", repeated: false }
                    : { ...scan, repeated: true });
                }}
              >
                <IconCircleCheck data-icon="inline-start" />
                {scan.kind !== "ready" ? "Scan same ticket again" : "Scan online ticket"}
              </Button>
              {scan.kind === "ready" ? (
              <Button
                variant="outline"
                type="button"
                onClick={() => showScan({ kind: "offline", repeated: false })}
              >
                <IconCloudUpload data-icon="inline-start" />
                Simulate offline scan
              </Button>
              ) : null}
            </div>
            {scan.kind !== "ready" ? (
              <p className="text-sm text-muted-foreground" role="status">
                {scan.repeated
                  ? "Repeat detected. The arrivals count has not increased."
                  : scan.kind === "synced"
                    ? "Synced successfully. No conflict found; this arrival is now confirmed."
                    : scan.kind === "online"
                      ? "Checked in. The dashboard now includes this arrival."
                    : "Saved on this phone, not confirmed yet. The confirmed arrivals count stays unchanged."}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                type="button"
                onClick={() => selectStep(1)}
              >
                <IconArrowLeft data-icon="inline-start" />
                View updated dashboard
              </Button>
              {scan.kind !== "ready" ? (
                <Button variant="ghost" type="button" onClick={() => setScan({ kind: "ready" })}>
                  <IconRotate data-icon="inline-start" />
                  Reset scan
                </Button>
              ) : null}
            </div>
            <div className="hidden border-t pt-5 lg:block">
              <p className="text-sm font-medium">Organizer’s confirmed arrivals</p>
              <p className="mt-2 text-3xl font-headline tabular-nums">{stats.checkedInCount} <span className="text-base font-normal text-muted-foreground">of {stats.registeredCount} guests</span></p>
              <p className="mt-2 text-sm text-muted-foreground">{scan.kind === "offline" ? "1 check-in waiting to sync. It is not included in this count." : "Confirmed arrivals only. Repeat scans never increase the count."}</p>
            </div>
          </div>
          <div ref={resultRef} className="mx-auto w-full max-w-sm scroll-mt-20">
            <div className="overflow-hidden rounded-xl border bg-background">
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                <p className="text-sm font-medium">{SAMPLE_EVENT.entrance}</p>
                <Badge
                  variant={scan.kind === "offline" ? "provisional" : "success"}
                >
                  {scan.kind === "offline" ? "Offline" : "Online"}
                </Badge>
              </div>
              {scan.kind === "ready" ? (
                <Empty className="min-h-56 rounded-none p-6 sm:min-h-80">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <IconQrcode aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>Ready to scan</EmptyTitle>
                    <EmptyDescription>
                      Choose a scan to see the answer your door team gets.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ScanOutcome
                  outcome={scan.repeated ? "duplicate" : scan.kind === "offline" ? "provisional" : "accepted"}
                  attendeeName={displayName}
                  ticketCode="7QM4X–K3B9T"
                  titleAs="p"
                  className="demo-scan-result min-h-72 justify-start py-6 sm:min-h-96 sm:py-10"
                />
              )}
              <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm" aria-live="polite">
                <span className="text-muted-foreground">Confirmed arrivals</span>
                <span className="font-medium tabular-nums">{stats.checkedInCount} of {stats.registeredCount}</span>
              </div>
              {scan.kind === "offline" ? (
                <div className="border-t p-4">
                  <Button className="w-full" type="button" onClick={() => showScan({ kind: "synced", repeated: false })}>
                    <IconCloudUpload data-icon="inline-start" />
                    Reconnect and sync
                  </Button>
                </div>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Simulated scanner. Sample data only; no camera access needed.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
