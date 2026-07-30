"use client";

import { useState, type FormEvent } from "react";
import {
  IconAlertCircle,
  IconCheck,
  IconFileSpreadsheet,
  IconUpload,
} from "@tabler/icons-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RegistrationImportPreview } from "./server/registration-import-application";

type Message = { kind: "error" | "success"; text: string } | null;

export function RegistrationImportWorkspace({ eventId }: { eventId: string }) {
  const [preview, setPreview] = useState<RegistrationImportPreview | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [pending, setPending] = useState<"preview" | "confirm" | null>(null);

  async function createPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("preview");
    setMessage(null);
    try {
      const response = await fetch(
        `/api/events/${encodeURIComponent(eventId)}/registrations/import/preview`,
        { method: "POST", body: new FormData(event.currentTarget) },
      );
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result === "object" &&
            result !== null &&
            "message" in result &&
            typeof result.message === "string"
            ? result.message
            : "The preview could not be created.",
        );
      }
      setPreview(result as RegistrationImportPreview);
    } catch (error) {
      setPreview(null);
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "The preview could not be created.",
      });
    } finally {
      setPending(null);
    }
  }

  async function confirmPreview() {
    if (!preview) return;
    setPending("confirm");
    setMessage(null);
    try {
      const response = await fetch(
        `/api/events/${encodeURIComponent(eventId)}/registrations/import/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ importId: preview.id }),
        },
      );
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result === "object" &&
            result !== null &&
            "message" in result &&
            typeof result.message === "string"
            ? result.message
            : "Nothing was imported.",
        );
      }
      const importedCount =
        typeof result === "object" &&
        result !== null &&
        "importedCount" in result &&
        typeof result.importedCount === "number"
          ? result.importedCount
          : preview.rows.length;
      setMessage({
        kind: "success",
        text: `${importedCount.toLocaleString()} Registration${importedCount === 1 ? "" : "s"} and signed Ticket${importedCount === 1 ? "" : "s"} imported.`,
      });
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Nothing was imported.",
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={createPreview} className="rounded-2xl border p-5 sm:p-6">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="registration-import-file">Registration CSV</FieldLabel>
            <Input
              id="registration-import-file"
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              disabled={pending !== null}
            />
            <FieldDescription>
              Up to 500 rows and 512 KB. Include name and email headers; custom
              columns may use a Registration Field label or ID. Separate
              multiple-choice answers with semicolons.
            </FieldDescription>
          </Field>
          <Button type="submit" className="w-fit" disabled={pending !== null}>
            {pending === "preview" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <IconUpload data-icon="inline-start" />
            )}
            Preview import
          </Button>
        </FieldGroup>
      </form>

      {message ? (
        <Alert variant={message.kind === "error" ? "destructive" : "default"}>
          {message.kind === "error" ? (
            <IconAlertCircle aria-hidden="true" />
          ) : (
            <IconCheck aria-hidden="true" />
          )}
          <AlertTitle>{message.kind === "error" ? "Import stopped" : "Import complete"}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      {!preview ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconFileSpreadsheet aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No import preview</EmptyTitle>
            <EmptyDescription>
              Uploading creates a normalized, expiring preview. The original
              file is not retained.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <section className="flex flex-col gap-5" aria-labelledby="import-preview-heading">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="import-preview-heading" className="text-lg font-medium">
                Import preview
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {preview.projectedCapacity.claimed.toLocaleString()} claimed +{" "}
                {preview.projectedCapacity.imported.toLocaleString()} ready to
                import of {preview.projectedCapacity.capacity.toLocaleString()} capacity.
              </p>
            </div>
            <Button
              onClick={confirmPreview}
              disabled={!preview.canConfirm || pending !== null || message?.kind === "success"}
            >
              {pending === "confirm" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <IconCheck data-icon="inline-start" />
              )}
              Confirm atomic import
            </Button>
          </div>

          <div className="flex flex-wrap gap-2" aria-label="CSV field mappings">
            {preview.mappings.map((mapping) => (
              <Badge key={mapping.header} variant="secondary">
                {mapping.header} → {mapping.label}
              </Badge>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border">
            <Table className="min-w-2xl">
              <TableHeader className="bg-muted/50 text-muted-foreground">
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Validation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row) => (
                  <TableRow key={row.rowNumber} className="[content-visibility:auto]">
                    <TableCell className="font-mono">{row.rowNumber}</TableCell>
                    <TableCell>{row.name || "—"}</TableCell>
                    <TableCell>{row.email || "—"}</TableCell>
                    <TableCell>
                      {row.errors.length === 0 ? (
                        <Badge variant="secondary">Ready</Badge>
                      ) : (
                        <ul className="flex min-w-64 list-disc flex-col gap-1 pl-4 text-destructive">
                          {[...new Set(row.errors)].map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
