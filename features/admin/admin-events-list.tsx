"use client";

import { useState } from "react";
import {
  IconCheck,
  IconEye,
  IconLock,
  IconLockOpen,
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
import { AdminTableToolbar } from "./admin-table-toolbar";

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
      <AdminTableToolbar
        label="Search events by name or web address"
        placeholder="Search name or web address"
        value={search}
        onValueChange={setSearch}
        shown={filteredEvents.length}
        total={events.length}
        noun="events"
      />

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader className="bg-muted/50 text-muted-foreground">
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No events match that search.
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
                          <IconLock aria-hidden="true" /> Suspended
                        </Badge>
                        {ev.suspensionReason && (
                          <p className="max-w-xs truncate text-xs text-muted-foreground">
                            {ev.suspensionReason}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <IconCheck aria-hidden="true" /> Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onInspectAttendeeData(ev.id)}
                      >
                        <IconEye data-icon="inline-start" />
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
                          <IconLockOpen data-icon="inline-start" />
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
                          <IconLock data-icon="inline-start" />
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
          title="Suspend this event?"
          description={`${selectedEvent.name} stops accepting registrations, syncing check-ins, and taking organizer changes. Nothing is deleted.`}
          actionLabel="Suspend event"
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
          title="Reactivate this event?"
          description={`${selectedEvent.name} starts accepting registrations and check-ins again.`}
          actionLabel="Reactivate event"
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
