import type { Metadata } from "next";
import Link from "next/link";
import {
  IconArrowDown,
  IconArrowRight,
  IconBrandGithub,
  IconCloudCheck,
  IconDeviceMobile,
  IconFingerprint,
  IconHistory,
  IconKey,
  IconLockCheck,
  IconQrcode,
  IconShieldCheck,
  IconTicket,
  IconUserCheck,
  IconUsersGroup,
  IconWifiOff,
} from "@tabler/icons-react";

import { EventPassMark } from "@/components/eventpass-mark";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { buttonVariants } from "@/components/ui/button";
import {
  ScanOutcomeShowcase,
  ShowcaseCaption,
  TicketShowcase,
} from "@/features/landing/product-showcase";
import { OperationsPreview } from "@/features/landing/operations-preview";

const REPOSITORY_URL = "https://github.com/Het-Jethva/eventpass";

export const metadata: Metadata = {
  title: {
    absolute: "EventPass — event check-in that works without Wi-Fi",
  },
  description:
    "EventPass handles registration, signed QR tickets, and door check-in for in-person events, with a scanner that keeps working when the venue network does not.",
};

const proofPoints = [
  {
    icon: IconFingerprint,
    title: "Signed at issue time",
    description: "ECDSA P-256",
  },
  {
    icon: IconWifiOff,
    title: "Useful without a network",
    description: "Bounded offline access",
  },
  {
    icon: IconCloudCheck,
    title: "Safe to retry",
    description: "Idempotent sync",
  },
  {
    icon: IconHistory,
    title: "Every correction retained",
    description: "Append-only audit",
  },
];

const roles = [
  {
    icon: IconUsersGroup,
    title: "Organize",
    summary:
      "Configure the event, capacity, registration form, staff access, and check-in window from one workspace.",
    detail: "For club organizers",
  },
  {
    icon: IconTicket,
    title: "Register",
    summary:
      "Attendees confirm by email and receive a signed QR ticket without creating another account or password.",
    detail: "For attendees",
  },
  {
    icon: IconUserCheck,
    title: "Admit",
    summary:
      "Volunteers get one unmistakable answer per scan, with explicit provisional states whenever the network is gone.",
    detail: "For door teams",
  },
];

const trustModel = [
  {
    icon: IconKey,
    title: "The ticket proves itself",
    description:
      "Each QR representation carries a P-256 signature that can be verified without exposing attendee details in the code.",
  },
  {
    icon: IconDeviceMobile,
    title: "Offline access is time-bounded",
    description:
      "A volunteer prepares the scanner while connected. The downloaded authorization and event snapshot expire instead of granting permanent offline power.",
  },
  {
    icon: IconCloudCheck,
    title: "Synchronization preserves uncertainty",
    description:
      "Offline scans are provisional until the server accepts them. Conflicts surface for review instead of being silently overwritten.",
  },
  {
    icon: IconLockCheck,
    title: "Privileged changes leave evidence",
    description:
      "Check-ins, reversals, role changes, and support access are retained with actor, time, and reason.",
  },
];

const workflow = [
  {
    step: "01",
    title: "Configure",
    description:
      "Create the event, set capacity and windows, build the form, and invite staff.",
  },
  {
    step: "02",
    title: "Register",
    description:
      "Guests verify their email and receive a signed, single-entry ticket.",
  },
  {
    step: "03",
    title: "Prepare",
    description:
      "Door volunteers download a time-bounded snapshot before the crowd arrives.",
  },
  {
    step: "04",
    title: "Admit and reconcile",
    description:
      "Scan online or off, synchronize safely, and review every exception afterwards.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-5 px-4 sm:px-6">
          <Link
            href="/"
            aria-label="EventPass home"
            className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <EventPassMark />
          </Link>
          <nav
            className="hidden items-center gap-5 border-l pl-5 text-sm text-muted-foreground md:flex"
            aria-label="Landing page"
          >
            <a className="transition-colors hover:text-foreground" href="#product">
              Product
            </a>
            <a className="transition-colors hover:text-foreground" href="#trust">
              Trust model
            </a>
            <a className="transition-colors hover:text-foreground" href="#workflow">
              Workflow
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeSwitcher />
            <span className="hidden sm:block">
              <a
                href={REPOSITORY_URL}
                aria-label="View EventPass source on GitHub"
                className={buttonVariants({
                  variant: "ghost",
                  size: "icon-sm",
                })}
              >
                <IconBrandGithub aria-hidden="true" />
              </a>
            </span>
            <Link
              href="/sign-in"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <span className="sm:hidden">Sign in</span>
              <span className="hidden sm:inline">Staff sign-in</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="overflow-hidden border-b bg-brand-subtle/20">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-14 lg:py-24">
            <div className="flex flex-col gap-7">
              <div className="flex flex-col gap-5">
                <h1 className="max-w-2xl font-heading text-5xl leading-none text-balance sm:text-6xl lg:text-7xl">
                  Keep the door moving, even when the network stops.
                </h1>
                <p className="max-w-xl text-base leading-7 text-muted-foreground text-pretty sm:text-lg sm:leading-8">
                  EventPass brings registration, signed QR tickets, and
                  trustworthy door check-in into one system. Volunteers keep
                  admitting guests through bad venue Wi-Fi, while organizers
                  keep an honest record of what happened.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="#product"
                  className={buttonVariants({ size: "lg" })}
                >
                  See the product
                  <IconArrowDown data-icon="inline-end" />
                </a>
                <a
                  href={REPOSITORY_URL}
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  <IconBrandGithub data-icon="inline-start" />
                  View source
                </a>
              </div>

              <p className="max-w-lg text-sm leading-6 text-muted-foreground">
                Built as a production-capable portfolio project with synthetic
                data, real persistence, and no mocked core workflow.
              </p>
            </div>

            <OperationsPreview />
          </div>
        </section>

        <section aria-label="Technical highlights" className="border-b bg-background">
          <div className="mx-auto grid w-full max-w-7xl sm:grid-cols-2 lg:grid-cols-4">
            {proofPoints.map(({ description, icon: Icon, title }, index) => (
              <div
                className="flex items-center gap-3 border-b px-4 py-5 sm:px-6 lg:border-b-0 lg:border-r lg:last:border-r-0"
                key={title}
              >
                <Icon
                  aria-hidden="true"
                  className="size-5 shrink-0 text-brand-text"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <span className="sr-only">Item {index + 1} of 4</span>
              </div>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="product-heading"
          className="border-b"
          id="product"
        >
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-16 sm:px-6 sm:py-24">
            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <h2
                id="product-heading"
                className="max-w-xl font-heading text-4xl leading-tight text-balance sm:text-5xl"
              >
                The difference between a confirmed yes and a qualified one.
              </h2>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground text-pretty lg:justify-self-end">
                Online, a check-in is final the moment it happens. Offline, it
                is stored on the volunteer&apos;s device and clearly marked
                provisional until synchronization establishes authority.
                EventPass never presents those states as the same thing.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <ScanOutcomeShowcase />
              <ShowcaseCaption />
            </div>

            <div className="grid gap-8 border-t pt-12 lg:grid-cols-[0.65fr_1.35fr] lg:items-center">
              <div className="flex flex-col gap-4">
                <IconQrcode
                  aria-hidden="true"
                  className="size-8 text-brand-text"
                />
                <h3 className="font-heading text-3xl leading-tight text-balance sm:text-4xl">
                  A ticket designed for the phone at the door.
                </h3>
                <p className="max-w-lg text-base leading-7 text-muted-foreground text-pretty">
                  The QR representation, short backup code, attendee, and event
                  identity lead on every viewport. The code scans from a phone,
                  prints cleanly, and contains no personal attendee data.
                </p>
              </div>
              <TicketShowcase />
            </div>
          </div>
        </section>

        <section aria-labelledby="roles-heading" className="border-b bg-muted/20">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <h2
                id="roles-heading"
                className="max-w-xl font-heading text-4xl leading-tight text-balance sm:text-5xl"
              >
                One event, three focused experiences.
              </h2>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground text-pretty lg:justify-self-end">
                Each role gets the information and actions required for the
                moment they are in—without carrying the complexity of everyone
                else&apos;s job.
              </p>
            </div>

            <ol className="mt-12 border-t">
              {roles.map(({ detail, icon: Icon, summary, title }) => (
                <li
                  className="grid gap-4 border-b py-7 sm:grid-cols-[3rem_0.55fr_1.45fr] sm:items-start sm:gap-6 sm:py-8"
                  key={title}
                >
                  <span className="flex size-10 items-center justify-center rounded-md border bg-background">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-heading text-3xl">{title}</h3>
                    <p className="mt-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {detail}
                    </p>
                  </div>
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground text-pretty">
                    {summary}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          aria-labelledby="trust-heading"
          className="border-b"
          id="trust"
        >
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.72fr_1.28fr]">
            <div className="flex flex-col items-start gap-5 lg:sticky lg:top-24 lg:self-start">
              <IconShieldCheck
                aria-hidden="true"
                className="size-9 text-brand-text"
              />
              <h2
                id="trust-heading"
                className="max-w-lg font-heading text-4xl leading-tight text-balance sm:text-5xl"
              >
                Trust is a chain of explicit decisions.
              </h2>
              <p className="max-w-lg text-base leading-7 text-muted-foreground text-pretty">
                EventPass treats offline operation as a security boundary, not
                a cache trick. Each stage preserves the distinction between
                what the device observed and what the server has confirmed.
              </p>
              <a
                href={`${REPOSITORY_URL}/tree/main/docs/adr`}
                className={buttonVariants({ variant: "outline" })}
              >
                Read the architecture decisions
                <IconArrowRight data-icon="inline-end" />
              </a>
            </div>

            <ol className="border-t">
              {trustModel.map(
                ({ description, icon: Icon, title }, index) => (
                  <li
                    className="grid gap-4 border-b py-7 sm:grid-cols-[3rem_1fr] sm:gap-6 sm:py-8"
                    key={title}
                  >
                    <span className="flex size-10 items-center justify-center rounded-md bg-brand-subtle text-brand-text">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-baseline justify-between gap-4">
                        <h3 className="text-lg font-semibold">{title}</h3>
                        <span className="font-mono text-xs text-muted-foreground">
                          0{index + 1}
                        </span>
                      </div>
                      <p className="max-w-2xl text-sm leading-6 text-muted-foreground text-pretty">
                        {description}
                      </p>
                    </div>
                  </li>
                ),
              )}
            </ol>
          </div>
        </section>

        <section
          aria-labelledby="workflow-heading"
          className="bg-primary text-primary-foreground"
          id="workflow"
        >
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <h2
                id="workflow-heading"
                className="max-w-xl font-heading text-4xl leading-tight text-balance sm:text-5xl"
              >
                From first form field to final headcount.
              </h2>
              <p className="max-w-2xl text-base leading-7 text-primary-foreground/70 text-pretty lg:justify-self-end">
                The happy path stays simple. The engineering depth appears when
                networks fail, tickets are reused, staff access changes, or an
                operator needs to correct a mistake.
              </p>
            </div>

            <ol className="mt-12 grid border-t border-primary-foreground/20 sm:grid-cols-2 lg:grid-cols-4">
              {workflow.map(({ description, step, title }) => (
                <li
                  className="flex flex-col gap-4 border-b border-primary-foreground/20 py-7 sm:px-6 sm:first:pl-0 lg:border-r lg:last:border-r-0 lg:last:pr-0"
                  key={step}
                >
                  <span className="font-mono text-xs text-primary-foreground/55">
                    {step}
                  </span>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="text-sm leading-6 text-primary-foreground/70 text-pretty">
                    {description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b bg-brand-subtle/35">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 py-14 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-16">
            <div className="flex max-w-2xl flex-col gap-3">
              <h2 className="font-heading text-4xl leading-tight text-balance sm:text-5xl">
                Built to be inspected, not just demoed.
              </h2>
              <p className="text-base leading-7 text-muted-foreground text-pretty">
                Explore the source, architecture decisions, test suite, and
                operational edge cases behind the interface.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href={REPOSITORY_URL}
                className={buttonVariants({ size: "lg" })}
              >
                <IconBrandGithub data-icon="inline-start" />
                Explore the repository
              </a>
              <Link
                href="/sign-in"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                Staff sign-in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-background">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <EventPassMark />
            <span className="hidden text-muted-foreground sm:inline">·</span>
            <p className="text-sm text-muted-foreground">
              Built by{" "}
              <a
                className="text-foreground underline-offset-4 hover:underline"
                href="https://github.com/Het-Jethva"
              >
                Het Jethva
              </a>
            </p>
          </div>
          <div className="flex items-center gap-5 text-sm">
            <a
              className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              href={`${REPOSITORY_URL}#readme`}
            >
              Documentation
            </a>
            <a
              className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              href={REPOSITORY_URL}
            >
              <IconBrandGithub aria-hidden="true" className="size-4" />
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
