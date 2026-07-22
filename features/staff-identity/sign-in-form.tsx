"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { IconAlertCircle, IconArrowRight } from "@tabler/icons-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { staffIdentityClient } from "@/lib/auth-client";

function isRateLimitError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 429
  );
}

export function SignInForm({ callbackURL = "/events" }: { callbackURL?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await staffIdentityClient.requestMagicLink(email, website, callbackURL);
        router.push("/sign-in/check-email");
      } catch (requestError) {
        setError(
          isRateLimitError(requestError)
            ? "Too many sign-in attempts. Wait a minute, then try again."
            : "We could not send a sign-in link. Check the address and try again.",
        );
      }
    });
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>
      {error ? (
        <Alert variant="destructive">
          <IconAlertCircle aria-hidden="true" />
          <AlertTitle>Sign-in link not sent</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="email">Work email</FieldLabel>
          <Input
            className="h-11"
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@university.edu"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(error)}
            required
            disabled={isPending}
          />
          <FieldDescription>
            We&apos;ll email a secure link that works once and expires in 15
            minutes.
          </FieldDescription>
        </Field>
      </FieldGroup>

      <Button className="h-11 w-full" size="lg" type="submit" disabled={isPending}>
        {isPending ? (
          <>
            <Spinner data-icon="inline-start" />
            Sending link…
          </>
        ) : (
          <>
            Continue with email
            <IconArrowRight data-icon="inline-end" />
          </>
        )}
      </Button>
      <p className="sr-only" aria-live="polite">
        {isPending ? "Sending your secure sign-in link." : ""}
      </p>
    </form>
  );
}
