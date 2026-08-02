import type { ReactNode } from "react";
import Link from "next/link";
import {
  IconClockHour4,
  IconDatabase,
  IconShieldCheck,
} from "@tabler/icons-react";

import { EventPassMark } from "@/components/eventpass-mark";

// The wordmark goes home, as it does in both the marketing and workspace
// headers. It was inert on this shell, which made sign-in — the surface a
// mistyped staff link most often lands on — the one page in the product with no
// way out except the browser's back button.
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
    title: "Short-lived access",
    description: "Every sign-in link expires after 15 minutes.",
  },
  {
    icon: IconShieldCheck,
    title: "Single use by design",
    description: "A link is consumed the moment it is verified.",
  },
  {
    icon: IconDatabase,
    title: "Revocable sessions",
    description: "Staff access is checked against the database.",
  },
];

export function PublicAuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-svh lg:grid-cols-[minmax(22rem,0.85fr)_minmax(30rem,1.15fr)]">
      <aside className="hidden border-r bg-muted/40 p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <HomeMark />

        <div className="flex max-w-md flex-col gap-10">
          {/* No label above the heading. "Staff workspace" said nothing the
              heading and the three safeguards below it do not already say, and
              a small grey line stacked over a headline is a decoration the
              sentence has to be read around. */}
          <div className="flex flex-col gap-4">
            <h2 className="text-3xl font-headline text-balance">
              Calm operations start with trustworthy access.
            </h2>
            <p className="max-w-sm text-reading text-muted-foreground text-pretty">
              EventPass keeps staff identity simple while every session remains
              durable, scoped, and revocable.
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
