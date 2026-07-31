import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";

import { EventPassMark } from "@/components/eventpass-mark";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { buttonVariants } from "@/components/ui/button";
import {
  ScanOutcomeShowcase,
  TicketShowcase,
} from "@/features/landing/product-showcase";
import { OperationsPreview } from "@/features/landing/operations-preview";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: {
    absolute: "EventPass — event check-in that works without Wi-Fi",
  },
  description:
    "Registration, tickets, and door check-in for in-person events. The scanner keeps working when the venue network does not.",
};

// Replaces a separate roles section that said these things a second time. Who
// does what is carried by the sentence, not by a label stacked above the
// heading, and the order is the list's own — it does not need numbering to be
// read left to right under a heading that already says "first" and "final".
const steps = [
  {
    title: "Set up the event",
    description:
      "Organizers set capacity and check-in times, build the registration form, and invite the people working the door.",
  },
  {
    title: "Register and get a ticket",
    description:
      "Guests confirm by email and their ticket arrives straight away. No account to create, nothing to install.",
  },
  {
    title: "Load the guest list",
    description:
      "Volunteers download the list onto their phone before the crowd arrives, so the door is ready before the network is tested.",
  },
  {
    title: "Scan and admit",
    description:
      "One scan, one clear answer. Anything unusual — a repeat, a wrong door, a canceled ticket — says so in plain words.",
  },
];

const assurances = [
  {
    title: "No one gets in twice",
    description:
      "A second scan of the same ticket says so, even if the two scans happened on different phones while both were offline.",
  },
  {
    title: "Mistakes are fixable",
    description:
      "Undo a check-in, reissue a ticket, or change who has access. Every correction keeps the name, time, and reason.",
  },
  {
    title: "The count is honest",
    description:
      "Arrivals, capacity, and anything still waiting to confirm are on one screen, so you never guess how full the room is.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      {/* 95%, not 90%. Two of the sections below carry the scanner's pinned
          mint and lavender surfaces, and at 90% they tinted the bar as they
          passed under it — a rectangle of saturated colour in the chrome, in a
          product where saturated colour is only ever a report about state. */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link
            href="/"
            aria-label="EventPass home"
            className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <EventPassMark />
          </Link>
          <nav
            className="hidden items-center gap-6 text-sm text-muted-foreground md:flex"
            aria-label="Sections"
          >
            <a className="transition-colors hover:text-foreground" href="#door">
              At the door
            </a>
            <a className="transition-colors hover:text-foreground" href="#ticket">
              The ticket
            </a>
            <a
              className="transition-colors hover:text-foreground"
              href="#how-it-works"
            >
              How it works
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeSwitcher />
            <Link
              href="/sign-in"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* The page opens on the product doing its job rather than on a claim
            about it. Every saturated colour below the fold belongs to a real
            component rendering a real state — the marketing page and the
            scanner share one palette because they are the same thing. */}
        <section className="border-b">
          <div className="mx-auto w-full max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24 sm:pb-16">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
              <h1 className="text-5xl font-headline text-balance sm:text-6xl lg:text-7xl">
                {/* On a phone the line broke at the hyphen and left "Wi-" and
                    "Fi" on separate lines. */}
                Keep the line moving when the{" "}
                <span className="whitespace-nowrap">Wi-Fi</span> doesn’t.
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground text-pretty">
                EventPass handles registration, sends every guest a ticket, and
                checks them in at the door — on a scanner that keeps working
                when the venue network gives out.
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>
                  Get started
                  <IconArrowRight data-icon="inline-end" />
                </Link>
                <a
                  href="#door"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  See a check-in
                </a>
              </div>
            </div>

            <div className="mt-14 sm:mt-20">
              <OperationsPreview />
            </div>
          </div>
        </section>

        <section aria-labelledby="door-heading" className="border-b" id="door">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-20 sm:px-6 sm:py-28">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <h2
                id="door-heading"
                className="max-w-lg text-4xl font-headline text-balance sm:text-5xl"
              >
                Two kinds of yes, never confused.
              </h2>
              <p className="max-w-xl text-lg text-muted-foreground text-pretty lg:justify-self-end">
                With a signal, a check-in is settled the moment it happens.
                Without one, it is held on the volunteer’s phone and shown as
                unconfirmed until it lands. EventPass will not colour those the
                same.
              </p>
            </div>

            <ScanOutcomeShowcase />

            <ul className="grid gap-x-10 gap-y-8 border-t pt-10 sm:grid-cols-3">
              {assurances.map(({ description, title }) => (
                <li className="flex flex-col gap-2" key={title}>
                  <h3 className="text-base font-medium">{title}</h3>
                  <p className="text-sm text-muted-foreground text-pretty">
                    {description}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          aria-labelledby="ticket-heading"
          className="border-b bg-muted"
          id="ticket"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[0.62fr_1.38fr] lg:items-center lg:gap-16">
            <div className="flex flex-col gap-5">
              <h2
                id="ticket-heading"
                className="text-4xl font-headline text-balance sm:text-5xl"
              >
                A ticket built for a phone at a door.
              </h2>
              <p className="text-lg text-muted-foreground text-pretty">
                The code, the guest, and the event lead on every screen size —
                never below a fold, never below a settings panel. It scans from
                a cracked phone in a dark corridor and prints cleanly if someone
                would rather bring paper.
              </p>
            </div>
            <TicketShowcase />
          </div>
        </section>

        <section aria-labelledby="how-heading" className="border-b" id="how-it-works">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
            <h2
              id="how-heading"
              className="max-w-xl text-4xl font-headline text-balance sm:text-5xl"
            >
              From the first sign-up to the final headcount.
            </h2>

            {/* Edge padding is decided per index rather than with `first:`,
                because the grid is two columns at `sm` and four at `lg`: a
                single `first:pl-0` left the third step indented against the
                measure while the first sat flush, one row below it. */}
            <ol className="mt-14 grid border-t sm:grid-cols-2 lg:grid-cols-4">
              {steps.map(({ description, title }, index) => (
                <li
                  className={cn(
                    "flex flex-col gap-2 border-b py-8 sm:px-7 lg:border-r",
                    index % 2 === 0 ? "sm:pl-0 lg:pl-7" : "sm:pr-0 lg:pr-7",
                    index === 0 && "lg:pl-0",
                    index === steps.length - 1 && "lg:border-r-0 lg:pr-0",
                  )}
                  key={title}
                >
                  <h3 className="text-lg font-medium text-balance">{title}</h3>
                  <p className="text-sm text-muted-foreground text-pretty">
                    {description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center sm:px-6 sm:py-28">
            <h2 className="max-w-2xl text-4xl font-headline text-balance sm:text-5xl">
              Set up your next event tonight.
            </h2>
            <p className="max-w-lg text-lg text-muted-foreground text-pretty">
              Create the event, share the registration link, and hand your door
              team a scanner that will not let you down at the worst moment.
            </p>
            <Link
              href="/sign-in"
              className={buttonVariants({ size: "lg", className: "mt-2" })}
            >
              Get started
              <IconArrowRight data-icon="inline-end" />
            </Link>
          </div>
        </section>
      </main>

      <footer>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <EventPassMark />
          <p className="text-sm text-muted-foreground">
            Event registration and door check-in.
          </p>
        </div>
      </footer>
    </div>
  );
}
