"use client";

import { useState } from "react";
import {
  IconArrowLeft,
  IconClock,
  IconShield,
  IconShieldLock,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTicketCode } from "@/features/tickets/ticket-code";
import { AdminActionDialog } from "./admin-action-dialog";
import { AdminTableToolbar } from "./admin-table-toolbar";

export interface SupportAttendeeRecord {
  id: string;
  attendeeName: string;
  attendeeEmail: string;
  status: string;
  createdAt: Date | string;
  ticketId?: string | null;
  ticketCode?: string | null;
  ticketStatus?: string | null;
}

export interface SupportAccessDetails {
  id: string;
  reason: string;
  expiresAt: Date | string;
}

interface SupportAccessViewProps {
  eventId: string;
  eventName: string;
  activeSupportAccess: SupportAccessDetails | null;
  registrations: SupportAttendeeRecord[];
  onGrantSupportAccess: (eventId: string, reason: string) => Promise<void>;
  onBack: () => void;
}

function formatTime(value: Date | string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SupportAccessView({
  eventId,
  eventName,
  activeSupportAccess,
  registrations,
  onGrantSupportAccess,
  onBack,
}: SupportAccessViewProps) {
  const [search, setSearch] = useState("");
  const [showGrantModal, setShowGrantModal] = useState(false);

  const term = search.trim().toLowerCase();
  const filteredRegistrations = term
    ? registrations.filter(
        (record) =>
          record.attendeeName.toLowerCase().includes(term) ||
          record.attendeeEmail.toLowerCase().includes(term) ||
          record.ticketCode?.toLowerCase().includes(term),
      )
    : registrations;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 border-b pb-6 sm:flex-row sm:items-center">
        <Button variant="outline" size="sm" onClick={onBack} className="self-start">
          <IconArrowLeft data-icon="inline-start" />
          All events
        </Button>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-medium">{eventName}</h2>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {eventId}
          </p>
        </div>
      </div>

      {!activeSupportAccess ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="bg-warning-subtle text-warning-text"
            >
              <IconShieldLock aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Attendee details are not visible</EmptyTitle>
            <EmptyDescription>
              Administrators have no standing access to attendee data. Record a
              reason to open a 60-minute window; the reason is kept permanently.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setShowGrantModal(true)}>
              <IconShield data-icon="inline-start" />
              Request access
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-xl border border-info-border bg-info-subtle p-4 text-info-text sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <IconShield aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  Access is open, and this session is recorded
                </p>
                <p className="mt-0.5 text-sm text-info-text/90">
                  {activeSupportAccess.reason}
                </p>
              </div>
            </div>
            <Badge variant="info" className="shrink-0 self-start sm:self-auto">
              <IconClock aria-hidden="true" />
              Until {formatTime(activeSupportAccess.expiresAt)}
            </Badge>
          </div>

          <AdminTableToolbar
            label="Search attendees by name, email, or ticket code"
            placeholder="Search name, email, or ticket code"
            value={search}
            onValueChange={setSearch}
            shown={filteredRegistrations.length}
            total={registrations.length}
            noun="attendees"
          />

          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader className="bg-muted/50 text-muted-foreground">
                <TableRow>
                  <TableHead scope="col">Attendee</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col">Ticket</TableHead>
                  <TableHead scope="col">Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-10 text-center text-muted-foreground"
                    >
                      {registrations.length === 0
                        ? "Nobody has registered for this event."
                        : "No attendees match that search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRegistrations.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {record.attendeeName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {record.attendeeEmail}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.ticketCode ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono tracking-code">
                              {formatTicketCode(record.ticketCode)}
                            </span>
                            <Badge variant="secondary" className="capitalize">
                              {record.ticketStatus}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <time dateTime={new Date(record.createdAt).toISOString()}>
                          {formatDateTime(record.createdAt)}
                        </time>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <AdminActionDialog
        title="Open attendee details?"
        description={`You will be able to see attendee names, emails, and ticket codes for ${eventName} for the next 60 minutes. The reason you give is kept permanently.`}
        actionLabel="Open for 60 minutes"
        isDestructive={false}
        isOpen={showGrantModal}
        onClose={() => setShowGrantModal(false)}
        onConfirm={async (reason) => {
          await onGrantSupportAccess(eventId, reason);
          setShowGrantModal(false);
        }}
      />
    </div>
  );
}
