"use client";

import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * Shared surface for segment error boundaries.
 *
 * Says what failed and what the reader can do, and never renders the thrown
 * message — those can carry query fragments or identifiers. The `digest` is
 * shown because it is the one thing that makes a report actionable, and it is
 * already safe to display.
 */
export function ErrorState({
  title,
  description,
  digest,
  onRetry,
}: {
  title: string;
  description: string;
  digest?: string;
  onRetry: () => void;
}) {
  return (
    <Empty className="min-h-72 border bg-background">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconAlertTriangle aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onRetry} variant="outline">
          <IconRefresh data-icon="inline-start" />
          Try again
        </Button>
        {digest ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Reference {digest}
          </p>
        ) : null}
      </EmptyContent>
    </Empty>
  );
}
