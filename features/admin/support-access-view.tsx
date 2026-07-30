"use client";

import { useState } from "react";
import {
  IconArrowLeft,
  IconClock,
  IconSearch,
  IconShield,
  IconShieldLock,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminActionDialog } from "./admin-action-dialog";

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

  const filteredRegistrations = registrations.filter(
    (reg) =>
      reg.attendeeName.toLowerCase().includes(search.toLowerCase()) ||
      reg.attendeeEmail.toLowerCase().includes(search.toLowerCase()) ||
      (reg.ticketCode && reg.ticketCode.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <IconArrowLeft className="mr-1.5 h-4 w-4" /> Back to Events
          </Button>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Support Access: {eventName}</h2>
            <p className="text-xs text-muted-foreground font-mono">Event ID: {eventId}</p>
          </div>
        </div>
      </div>

      {!activeSupportAccess ? (
        <div className="rounded-lg border border-warning-border bg-warning-subtle p-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning/20 text-warning-text">
            <IconShieldLock className="h-6 w-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-semibold">Reasoned Support Access Required</h3>
            <p className="text-xs text-muted-foreground">
              Platform Administrators do not have implicit access to attendee data. You must explicitly record a reasoned, time-limited elevation for support investigations.
            </p>
          </div>
          <Button onClick={() => setShowGrantModal(true)} variant="default">
            <IconShield className="mr-1.5 h-4 w-4" /> Request Time-Limited Support Access
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <IconShield className="h-5 w-5 text-primary shrink-0" />
              <div>
                <div className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Active Support Access — Audited
                </div>
                <div className="text-sm font-medium text-foreground">
                  Reason: &quot;{activeSupportAccess.reason}&quot;
                </div>
              </div>
            </div>
            <Badge variant="outline" className="border-primary/40 bg-background text-primary gap-1 shrink-0">
              <IconClock className="h-3.5 w-3.5" />
              Expires at: {new Date(activeSupportAccess.expiresAt).toLocaleTimeString()}
            </Badge>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search attendees by name, email, ticket code..."
                className="w-full rounded-md border bg-background pl-9 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                aria-label="Search attendees"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Showing {filteredRegistrations.length} attendee records
            </p>
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader className="bg-muted/50 text-xs text-muted-foreground">
                <TableRow>
                  <TableHead>Attendee</TableHead>
                  <TableHead>Registration status</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Registered at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      No attendee records found for this Event.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRegistrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{reg.attendeeName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{reg.attendeeEmail}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {reg.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {reg.ticketCode ? (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{reg.ticketCode}</span>
                            <Badge variant="secondary" className="text-xs capitalize">
                              {reg.ticketStatus}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No ticket issued</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(reg.createdAt).toLocaleDateString()}{" "}
                        {new Date(reg.createdAt).toLocaleTimeString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {showGrantModal && (
        <AdminActionDialog
          title={`Grant Support Access (${eventName})`}
          description="Granting Support Access allows inspecting attendee data for this specific event for 60 minutes. An immutable audit entry will be generated."
          actionLabel="Grant Support Access"
          isDestructive={false}
          isOpen={true}
          onClose={() => setShowGrantModal(false)}
          onConfirm={async (reason) => {
            await onGrantSupportAccess(eventId, reason);
            setShowGrantModal(false);
          }}
        />
      )}
    </div>
  );
}
