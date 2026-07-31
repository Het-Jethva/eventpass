import Link from "next/link";
import { IconArrowLeft, IconMailCheck } from "@tabler/icons-react";

import { PublicAuthShell } from "@/components/public-auth-shell";
import { Button } from "@/components/ui/button";

export default function CheckEmailPage() {
  return (
    <PublicAuthShell>
      <div className="flex flex-col gap-8">
        <span className="flex size-12 items-center justify-center rounded-xl border bg-muted">
          <IconMailCheck aria-hidden="true" className="size-6" />
        </span>
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-headline text-balance">
            Check your email
          </h1>
          <p className="max-w-sm text-base leading-7 text-muted-foreground text-pretty">
            We sent a secure EventPass sign-in link. Open it on this device to
            continue to your staff workspace.
          </p>
        </div>

        <div className="border-y py-5">
          <p className="text-sm font-medium">The link expires in 15 minutes</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            It can only be used once. Check your spam folder if it does not
            arrive within a minute.
          </p>
        </div>

        <Button variant="outline" render={<Link href="/sign-in" />}>
          <IconArrowLeft data-icon="inline-start" />
          Use a different email
        </Button>
      </div>
    </PublicAuthShell>
  );
}
