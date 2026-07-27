import type { Metadata } from "next";
import Link from "next/link";
import {
  IconBrandGithub,
  IconCalendarEvent,
  IconDeviceMobile,
  IconHistory,
  IconLock,
  IconQrcode,
  IconRouteAltLeft,
  IconTicket,
  IconWifiOff,
} from "@tabler/icons-react";

import { EventPassMark } from "@/components/eventpass-mark";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { buttonVariants } from "@/components/ui/button";

const REPOSITORY_URL = "https://github.com/Het-Jethva/eventpass";

export const metadata: Metadata = {
  title: {
    absolute: "EventPass — event check-in that stays trustworthy offline",
  },
  description:
    "EventPass handles registration, signed QR tickets, and attendance for in-person events, with a scanner that keeps working when venue internet does not.",
};

const roles = [
  {
    icon: IconCalendarEvent,
    role: "Organizers",
    summary: "Configure the event and watch it run.",
    points: [
      "Set venue, schedule, time zone, capacity, and registration and check-in windows.",
      "Build a registration form from short-text, choice, and acknowledgment fields.",
      "Invite organizers and check-in volunteers scoped to one event only.",
      "Follow a live operations dashboard and an immutable audit history.",
    ],
  },
  {
    icon: IconTicket,
    role: "Attendees",
    summary: "Register and get in without an account.",
    points: [
      "Register with no password and no account, holding a place for 15 minutes.",
      "Verify by email, then receive a signed QR ticket and a 10-character fallback code.",
      "Join a waitlist that promotes in order of verification when capacity opens.",
      "Manage, resend, replace, or cancel a registration through a revocable link.",
    ],
  },
  {
    icon: IconDeviceMobile,
    role: "Volunteers",
    summary: "Admit people quickly at the door.",
    points: [
      "Scan with the camera or type the ticket code when scanning is unavailable.",
      "Read one unmistakable outcome per scan: accepted, duplicate, invalid, or expired.",
      "Keep admitting during connectivity loss using a downloaded event snapshot.",
      "Reverse an accidental check-in within 30 seconds, with a reason recorded.",
    ],
  },
];

const guarantees = [
  {
    icon: IconQrcode,
    title: "Tickets are signed, not guessed",
    description:
      "Every ticket is a compact JWS signed with an ECDSA P-256 key ring. The payload carries only a schema version and two opaque identifiers, so presenting a ticket discloses no personal information. Rotated keys keep their public half so tickets issued earlier stay verifiable.",
  },
  {
    icon: IconWifiOff,
    title: "Offline mode states its own limits",
    description:
      "A volunteer downloads a minimal event snapshot — opaque ticket identifiers, display names, and validity state, never emails or form answers. Signatures are verified locally through Web Crypto, and snapshot age and offline status stay on screen so a local decision is never mistaken for an authoritative one.",
  },
  {
    icon: IconRouteAltLeft,
    title: "Offline duplicates are detected and resolved",
    description:
      "Two isolated scanners can accept the same ticket, so EventPass does not claim to prevent that. Synchronization surfaces the conflict instead: the earliest high-confidence attempt becomes the check-in automatically, low-confidence clock disagreements require a reasoned organizer decision, and every competing attempt is kept.",
  },
  {
    icon: IconHistory,
    title: "Privileged actions stay accountable",
    description:
      "Scan attempts and security-relevant changes land in a database-enforced append-only audit store recording actor, target, time, device, and reason. Audit entries deliberately exclude registration answers and bearer secrets.",
  },
];

const stack = [
  { label: "Framework", value: "Next.js 16 · React 19" },
  { label: "Language", value: "TypeScript" },
  { label: "Database", value: "PostgreSQL on Neon · Drizzle ORM" },
  { label: "Identity", value: "Better Auth magic links" },
  { label: "Offline", value: "Serwist PWA · Dexie · IndexedDB" },
  { label: "Email", value: "Resend with signed webhooks" },
];

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <EventPassMark />
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeSwitcher />
            <a
              href={REPOSITORY_URL}
              className={buttonVariants({ variant: "ghost", size: "icon" })}
              aria-label="View EventPass source on GitHub"
            >
              <IconBrandGithub aria-hidden="true" />
            </a>
            <Link
              href="/sign-in"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Staff sign-in
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6 sm:py-24">
            <div className="flex flex-col gap-5">
              <p className="text-sm font-medium text-muted-foreground">
                Registration, ticketing, and attendance for in-person events
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl sm:leading-[1.1]">
                Event check-in that stays trustworthy when the internet does
                not.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground text-pretty sm:text-lg sm:leading-8">
                University clubs run events in basements, gyms, and lecture
                halls where the venue network is unreliable. EventPass issues
                signed single-entry tickets, keeps the door moving when
                connectivity drops, and reconciles what happened afterwards
                without quietly discarding anything.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>
                Staff sign-in
              </Link>
              <a
                href={REPOSITORY_URL}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <IconBrandGithub aria-hidden="true" data-icon="inline-start" />
                Read the source
              </a>
            </div>

            <p className="flex max-w-2xl items-start gap-2.5 border-t pt-6 text-sm leading-6 text-muted-foreground">
              <IconLock
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                A portfolio project built on production infrastructure. There is
                no demo mode, no seeded data, and no reset button — every record
                is synthetic and was created through the same workflows a real
                organizer would use.
              </span>
            </p>
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
                className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl"
              >
                Three roles, three jobs
              </h2>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground text-pretty">
                Each role sees only what its immediate job requires. Access to
                one event grants nothing on any other.
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

        <section aria-labelledby="guarantees-heading" className="border-b">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="flex flex-col gap-3">
              <h2
                id="guarantees-heading"
                className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl"
              >
                What the admission guarantee actually is
              </h2>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground text-pretty">
                The offline story is deliberately bounded, and the interface
                says so rather than implying certainty it cannot deliver.
              </p>
            </div>

            <div className="mt-10 grid border-t sm:grid-cols-2 sm:gap-x-10">
              {guarantees.map(({ description, icon: Icon, title }) => (
                <div
                  className="flex flex-col gap-3 border-b py-8"
                  key={title}
                >
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

        <section aria-labelledby="stack-heading" className="bg-muted/20">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="flex flex-col gap-3">
              <h2
                id="stack-heading"
                className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl"
              >
                Built as one modular monolith
              </h2>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground text-pretty">
                Domain authorization and invariants live at server-only
                application-service boundaries close to the database. Server
                actions and route handlers are treated as untrusted transport.
                Capacity-changing operations serialize on a per-event row lock,
                so the final place cannot be sold twice.
              </p>
            </div>

            <dl className="mt-10 grid border-t sm:grid-cols-2 lg:grid-cols-3">
              {stack.map(({ label, value }) => (
                <div className="flex flex-col gap-1 border-b py-5" key={label}>
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {label}
                  </dt>
                  <dd className="text-sm">{value}</dd>
                </div>
              ))}
            </dl>
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
              className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              href={REPOSITORY_URL}
            >
              Source
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
