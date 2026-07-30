import type { Metadata } from "next";
import Link from "next/link";
import {
  IconBrandGithub,
  IconCalendarEvent,
  IconChecks,
  IconDeviceMobile,
  IconHistory,
  IconQrcode,
  IconTicket,
  IconWifiOff,
} from "@tabler/icons-react";

import { EventPassMark } from "@/components/eventpass-mark";
import {
  ScanOutcomeShowcase,
  ShowcaseCaption,
  TicketShowcase,
} from "@/features/landing/product-showcase";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { buttonVariants } from "@/components/ui/button";

const REPOSITORY_URL = "https://github.com/Het-Jethva/eventpass";

export const metadata: Metadata = {
  title: {
    absolute: "EventPass — event check-in that works without Wi-Fi",
  },
  description:
    "EventPass handles registration, QR tickets, and door check-in for in-person events, with a scanner that keeps working when the venue network does not.",
};

const roles = [
  {
    icon: IconCalendarEvent,
    role: "Organizers",
    summary: "Set the event up and watch it run.",
    points: [
      "Set venue, schedule, capacity, and when registration and check-in open.",
      "Build your own registration form in a few clicks.",
      "Invite co-organizers and door volunteers to a single event.",
      "Watch arrivals live and see exactly what happened afterwards.",
    ],
  },
  {
    icon: IconTicket,
    role: "Attendees",
    summary: "Register and get in without an account.",
    points: [
      "Sign up in under a minute — no password, no account to create.",
      "Confirm by email and get a QR ticket plus a short backup code.",
      "Join the waitlist and move up automatically when a spot opens.",
      "Change, resend, or cancel a registration from one private link.",
    ],
  },
  {
    icon: IconDeviceMobile,
    role: "Volunteers",
    summary: "Keep the door moving.",
    points: [
      "Scan with a phone camera, or type the code when scanning won't cooperate.",
      "Get one clear answer per scan: let them in, already used, or not valid.",
      "Keep checking people in even when the venue Wi-Fi drops.",
      "Undo an accidental check-in within 30 seconds.",
    ],
  },
];

const promises = [
  {
    icon: IconQrcode,
    title: "Tickets that can't be faked",
    description:
      "Each ticket is issued to one person and works once. A screenshot passed to a friend gets turned away at the door, and the ticket itself carries nothing personal about the guest.",
  },
  {
    icon: IconWifiOff,
    title: "The door never stops",
    description:
      "Before doors open, volunteers download the guest list to their phone. If the network drops mid-event, scanning carries on as normal — and the screen always shows whether it's working online or from the downloaded copy.",
  },
  {
    icon: IconChecks,
    title: "Everything syncs back up",
    description:
      "When phones reconnect, every scan is merged back into one list. If two doors admitted the same ticket, EventPass flags it for you instead of silently picking a winner.",
  },
  {
    icon: IconHistory,
    title: "A record you can trust",
    description:
      "Every check-in, reversal, and staff change is logged with who did it, when, and why — and nothing in that log can be edited or deleted after the fact.",
  },
];

const steps = [
  {
    step: "01",
    title: "Create the event",
    description:
      "Add the details, set your capacity, and design the registration form your guests will fill in.",
  },
  {
    step: "02",
    title: "Share the link",
    description:
      "Guests register and get a QR ticket by email. Once you're full, everyone else joins the waitlist.",
  },
  {
    step: "03",
    title: "Scan at the door",
    description:
      "Volunteers open the scanner on their phones and admit people, online or off.",
  },
  {
    step: "04",
    title: "See how it went",
    description:
      "Attendance, no-shows, and a full check-in history, ready the moment the event ends.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <EventPassMark />
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeSwitcher />
            <Link
              href="/sign-in"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {/* The mark, the theme group, and a full-width label did not fit
                  a 375px viewport together, and the row scrolled sideways. */}
              <span className="sm:hidden">Sign in</span>
              <span className="hidden sm:inline">Staff sign-in</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6 sm:py-24">
            <div className="flex flex-col gap-5">
              <p className="text-sm font-medium text-muted-foreground">
                Registration, ticketing, and check-in for in-person events
              </p>
              <h1 className="max-w-3xl font-heading text-5xl leading-[1.05] text-balance sm:text-6xl">
                Event check-in that keeps working when the Wi-Fi doesn&apos;t.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground text-pretty sm:text-lg sm:leading-8">
                Basements, gyms, lecture halls — the places events actually
                happen rarely have reliable internet. EventPass sends every
                guest a QR ticket, keeps the queue moving when the signal
                disappears, and gives you a clean attendance record afterwards.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>
                Staff sign-in
              </Link>
              <a
                href="#how-it-works"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                See how it works
              </a>
            </div>
          </div>
        </section>

        {/* The product itself, rather than three thousand words describing it.
            These are the real components with static props — see
            features/landing/product-showcase.tsx. */}
        <section aria-labelledby="showcase-heading" className="border-b">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 sm:py-20">
            <div className="flex flex-col gap-3">
              <h2 id="showcase-heading" className="font-heading text-4xl sm:text-5xl">
                One scan, two honest answers
              </h2>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground text-pretty">
                Online, a check-in is final the moment it happens. Offline, it
                is stored on the phone and clearly marked provisional until it
                syncs. EventPass never shows you the first when it only means
                the second.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <ScanOutcomeShowcase />
              <ShowcaseCaption />
            </div>

            <div className="flex flex-col gap-6 border-t pt-10">
              <div className="flex flex-col gap-3">
                <h3 className="font-heading text-3xl sm:text-4xl">
                  A ticket worth keeping
                </h3>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground text-pretty">
                  Every guest gets a QR representation and a short code they can
                  read out if scanning won&apos;t cooperate. It prints, and it
                  works on a phone at the door without an account.
                </p>
              </div>
              <TicketShowcase />
            </div>
          </div>
        </section>

        <section
          aria-labelledby="roles-heading"
          className="border-b bg-muted/20"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="flex flex-col gap-3">
              <h2
                id="roles-heading"
                className="font-heading text-4xl sm:text-5xl"
              >
                Built for everyone at the event
              </h2>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground text-pretty">
                Everyone sees exactly what they need for their part of the
                night, and nothing else.
              </p>
            </div>

            <div className="mt-10 grid border-t sm:grid-cols-3 sm:divide-x">
              {roles.map(({ icon: Icon, points, role, summary }) => (
                <div
                  className="flex flex-col gap-4 border-b py-8 sm:px-6 sm:first:pl-0 sm:last:pr-0"
                  key={role}
                >
                  <span className="flex size-9 items-center justify-center rounded-lg border bg-background">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-semibold">{role}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {summary}
                    </p>
                  </div>
                  <ul className="flex flex-col gap-2.5">
                    {points.map((point) => (
                      <li
                        className="text-sm leading-6 text-muted-foreground"
                        key={point}
                      >
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="promises-heading" className="border-b">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="flex flex-col gap-3">
              <h2
                id="promises-heading"
                className="font-heading text-4xl sm:text-5xl"
              >
                Why the door stays calm
              </h2>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground text-pretty">
                Four things you shouldn&apos;t have to think about on the night.
              </p>
            </div>

            <div className="mt-10 grid border-t sm:grid-cols-2 sm:gap-x-10">
              {promises.map(({ description, icon: Icon, title }) => (
                <div className="flex flex-col gap-3 border-b py-8" key={title}>
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <h3 className="text-base font-semibold text-balance">
                      {title}
                    </h3>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground text-pretty">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="how-it-works-heading"
          className="bg-muted/20"
          id="how-it-works"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="flex flex-col gap-3">
              <h2
                id="how-it-works-heading"
                className="font-heading text-4xl sm:text-5xl"
              >
                From first invite to final headcount
              </h2>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground text-pretty">
                Four steps, and no spreadsheet at the door.
              </p>
            </div>

            <ol className="mt-10 grid border-t sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-4 lg:gap-x-8">
              {steps.map(({ description, step, title }) => (
                <li className="flex flex-col gap-2 border-b py-8" key={step}>
                  <span className="text-xs font-medium tracking-wide text-muted-foreground">
                    {step}
                  </span>
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground text-pretty">
                    {description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-muted-foreground">
            EventPass — built by{" "}
            <a
              className="text-foreground underline-offset-4 hover:underline"
              href="https://github.com/Het-Jethva"
            >
              Het Jethva
            </a>
            .
          </p>
          <div className="flex items-center gap-4 text-sm">
            <a
              className="flex items-center gap-1.5 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              href={REPOSITORY_URL}
            >
              <IconBrandGithub aria-hidden="true" className="size-4" />
              GitHub
            </a>
            <Link
              className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              href="/sign-in"
            >
              Staff sign-in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
