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
          <Badge variant="provisional" className="hidden sm:inline-flex">
            Demo
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            <ThemeSwitcher />
            <PendingLink
              href="/sign-in"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "h-11",
              })}
              pendingLabel="Opening sign in"
            >
              Sign in
            </PendingLink>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10">
          <div className="flex max-w-3xl flex-col gap-2">
              <h1 className="text-3xl font-headline text-balance sm:text-4xl">
                Your first guest, from sign-up to check-in.
              </h1>
              <p className="text-sm text-muted-foreground sm:text-base">
                Try a sample event. Nothing is sent or saved. No account needed.
              </p>
          </div>

          <DemoExperience qrDataUrl={qrDataUrl} />

          <p className="border-t pt-6 text-sm text-muted-foreground">
            Ready for your own event?{" "}
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
