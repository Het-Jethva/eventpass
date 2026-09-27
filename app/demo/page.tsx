import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";

import { EventPassMark } from "@/components/eventpass-mark";
import { PendingLink } from "@/components/pending-link";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DemoExperience } from "@/features/demo/demo-experience";
import { SAMPLE_EVENT } from "@/features/demo/demo-sample";

export const metadata: Metadata = {
  title: "EventPass demo — try the full loop without signing in",
  description:
    "Register as a guest, watch the operations dashboard, and scan at the door. Sample data only, resets on refresh.",
};

export default async function DemoPage() {
  const qrDataUrl = await QRCode.toDataURL(
    `eventpass:sample:${SAMPLE_EVENT.ticketCode}`,
    { errorCorrectionLevel: "M", margin: 2, width: 480 },
  );

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link
            href="/"
            aria-label="EventPass home"
            className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <EventPassMark />
          </Link>
          <Badge variant="provisional">Demo</Badge>
          <div className="ml-auto flex items-center gap-2">
            <ThemeSwitcher />
            <PendingLink
              href="/sign-in"
              className={buttonVariants({ variant: "outline", size: "sm" })}
              pendingLabel="Opening sign in"
            >
              Sign in
            </PendingLink>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
          <div className="flex flex-col gap-4">
            <p className="rounded-lg border border-provisional-border bg-provisional-subtle px-4 py-3 text-sm text-provisional-text">
              Sample event — {SAMPLE_EVENT.name}. Everything here runs in the
              browser and resets on refresh. Production has no seeded data.
            </p>
            <div className="flex max-w-3xl flex-col gap-3">
              <h1 className="text-4xl font-headline text-balance sm:text-5xl">
                Try the full loop in a minute.
              </h1>
              <p className="text-lg text-muted-foreground">
                Register as a guest, see the organizer dashboard move, then
                scan at the door — including the offline case this product
                exists for.
              </p>
            </div>
          </div>

          <DemoExperience qrDataUrl={qrDataUrl} />

          <p className="border-t pt-6 text-sm text-muted-foreground">
            This demo renders the real ticket and scanner components with
            sample props and stores nothing. To run a real event,{" "}
            <Link href="/sign-in" className="underline underline-offset-4">
              sign in
            </Link>
            .
          </p>
        </div>
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
