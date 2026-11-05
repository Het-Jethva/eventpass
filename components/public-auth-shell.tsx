import type { ReactNode } from "react";
import Link from "next/link";
import {
  IconClockHour4,
  IconTicket,
  IconShieldCheck,
} from "@tabler/icons-react";

import { EventPassMark } from "@/components/eventpass-mark";

// The wordmark goes home, as it does in the marketing and workspace headers.
function HomeMark() {
  return (
    <Link
      href="/"
      aria-label="EventPass home"
      className="w-fit rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <EventPassMark />
    </Link>
  );
}

const assurances = [
  {
    icon: IconClockHour4,
    title: "No password to remember",
    description: "Open the sign-in link we send to your inbox.",
  },
  {
    icon: IconShieldCheck,
    title: "A link just for you",
    description: "It works once and expires after 15 minutes.",
  },
  {
    icon: IconTicket,
    title: "Your events in one place",
    description: "Create an event or open one your team has invited you to.",
  },
];

export function PublicAuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-svh lg:grid-cols-[minmax(22rem,0.85fr)_minmax(30rem,1.15fr)]">
      <aside className="hidden border-r bg-muted/40 p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <HomeMark />

        <div className="flex max-w-md flex-col gap-10">
          {/* No label above the heading. The heading and the safeguards below it already say it. */}
          <div className="flex flex-col gap-4">
            <h2 className="text-3xl font-headline text-balance">
              Your next event starts here.
            </h2>
            <p className="max-w-sm text-reading text-muted-foreground text-pretty">
              Bring your guest list, tickets, and door team together. Sign in
              with your email and get ready to open the doors.
            </p>
          </div>

          <ul className="flex flex-col gap-5" aria-label="Sign-in safeguards">
            {assurances.map(({ description, icon: Icon, title }) => (
              <li className="flex gap-3" key={title}>
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-support text-muted-foreground">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          Built for university clubs running real doors.
        </p>
      </aside>

      <section className="flex min-h-svh flex-col">
        <header className="flex h-20 items-center border-b px-6 lg:hidden">
          <HomeMark />
        </header>
        <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </section>
    </main>
  );
}
