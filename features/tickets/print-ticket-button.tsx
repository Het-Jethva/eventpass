"use client";

import { IconPrinter } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";

export function PrintTicketButton() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <IconPrinter aria-hidden="true" data-icon="inline-start" />
      Print ticket
    </Button>
  );
}
