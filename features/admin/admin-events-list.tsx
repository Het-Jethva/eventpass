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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Event Name & Slug</th>
                <th className="px-4 py-3">Lifecycle Status</th>
                <th className="px-4 py-3">Suspension State</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No platform events match your search.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{ev.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">/e/{ev.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="capitalize">
                        {ev.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {ev.suspended ? (
                        <div className="space-y-1">
                          <Badge variant="destructive" className="gap-1">
                            <IconLock className="h-3 w-3" /> Event Suspended
                          </Badge>
                          {ev.suspensionReason && (
                            <p className="text-xs text-muted-foreground italic truncate max-w-xs">
                              Reason: {ev.suspensionReason}
                            </p>
                          )}
                        </div>
                      ) : (
                        <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <IconCheck className="h-3 w-3" /> Active
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onInspectAttendeeData(ev.id)}
                          title="Inspect Attendee Data under Support Access"
                        >
                          <IconEye className="mr-1.5 h-3.5 w-3.5 text-primary" />
                          Inspect Attendees
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
                            <IconLockOpen className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
