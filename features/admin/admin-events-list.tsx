"use client";

import { useState } from "react";
import {
  IconCheck,
  IconEye,
  IconLock,
  IconLockOpen,
  IconSearch,
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

export interface EventItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  capacity: number;
  suspended: boolean;
  suspendedAt?: Date | string | null;
  suspensionReason?: string | null;
  startsAt: Date | string;
  createdAt: Date | string;
}

interface AdminEventsListProps {
  events: EventItem[];
  onSuspendEvent: (eventId: string, reason: string) => Promise<void>;
  onReactivateEvent: (eventId: string, reason: string) => Promise<void>;
  onInspectAttendeeData: (eventId: string) => void;
}

export function AdminEventsList({
  events,
  onSuspendEvent,
  onReactivateEvent,
  onInspectAttendeeData,
}: AdminEventsListProps) {
  const [search, setSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [actionType, setActionType] = useState<"suspend" | "reactivate" | "support_access" | null>(null);

  const filteredEvents = events.filter(
    (ev) =>
      ev.name.toLowerCase().includes(search.toLowerCase()) ||
      ev.slug.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search platform events..."
            className="w-full rounded-md border bg-background pl-9 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
            aria-label="Search platform events"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Showing {filteredEvents.length} of {events.length} events
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader className="bg-muted/50 text-xs text-muted-foreground">
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Lifecycle status</TableHead>
              <TableHead>Suspension state</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No platform events match your search.
                </TableCell>
              </TableRow>
            ) : (
              filteredEvents.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{ev.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">/e/{ev.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {ev.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {ev.suspended ? (
                      <div className="space-y-1">
                        <Badge variant="destructive" className="gap-1">
                          <IconLock className="h-3 w-3" /> Event Suspended
                        </Badge>
                        {ev.suspensionReason && (
                          <p className="max-w-xs truncate text-xs text-muted-foreground">
                            Reason: {ev.suspensionReason}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <IconCheck className="h-3 w-3" /> Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onInspectAttendeeData(ev.id)}
                        title="View attendee details with support access"
                      >
                        <IconEye className="mr-1.5 h-3.5 w-3.5" />
                        View attendees
                      </Button>

                      {ev.suspended ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedEvent(ev);
                            setActionType("reactivate");
                          }}
                        >
                          <IconLockOpen className="mr-1.5 h-3.5 w-3.5" />
                          Reactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedEvent(ev);
                            setActionType("suspend");
                          }}
                        >
                          <IconLock className="mr-1.5 h-3.5 w-3.5" />
                          Suspend
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selectedEvent && actionType === "suspend" && (
        <AdminActionDialog
          title={`Suspend Event (${selectedEvent.name})`}
          description="Suspension halts online registrations, check-in sync, and organizer mutations for this event without deleting domain data."
          actionLabel="Suspend Event"
          isDestructive={true}
          isOpen={true}
          onClose={() => {
            setSelectedEvent(null);
            setActionType(null);
          }}
          onConfirm={async (reason) => {
            await onSuspendEvent(selectedEvent.id, reason);
          }}
        />
      )}

      {selectedEvent && actionType === "reactivate" && (
        <AdminActionDialog
          title={`Reactivate Event (${selectedEvent.name})`}
          description="Reactivating restores online activity for this event."
          actionLabel="Reactivate Event"
          isDestructive={false}
          isOpen={true}
          onClose={() => {
            setSelectedEvent(null);
            setActionType(null);
          }}
          onConfirm={async (reason) => {
            await onReactivateEvent(selectedEvent.id, reason);
          }}
        />
      )}
    </div>
  );
}
