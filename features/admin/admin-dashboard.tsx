"use client";

import { useState } from "react";
import { IconCalendar, IconShield, IconUsers } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { AdminAccountsList, type AccountItem } from "./admin-accounts-list";
import { AdminEventsList, type EventItem } from "./admin-events-list";
import {
  SupportAccessView,
  type SupportAccessDetails,
  type SupportAttendeeRecord,
} from "./support-access-view";

interface AdminDashboardProps {
  accounts: AccountItem[];
  events: EventItem[];
  adminEmail: string;
  onSuspendAccount: (userId: string, reason: string) => Promise<void>;
  onReactivateAccount: (userId: string, reason: string) => Promise<void>;
  onSuspendEvent: (eventId: string, reason: string) => Promise<void>;
  onReactivateEvent: (eventId: string, reason: string) => Promise<void>;
  onGrantSupportAccess: (eventId: string, reason: string) => Promise<void>;
  onFetchSupportData: (eventId: string) => Promise<{
    event: { id: string; name: string; slug: string } | undefined;
    activeSupportAccess: SupportAccessDetails;
    registrations: SupportAttendeeRecord[];
  }>;
}

export function AdminDashboard({
  accounts,
  events,
  adminEmail,
  onSuspendAccount,
  onReactivateAccount,
  onSuspendEvent,
  onReactivateEvent,
  onGrantSupportAccess,
  onFetchSupportData,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"accounts" | "events">("accounts");
  const [inspectingEventId, setInspectingEventId] = useState<string | null>(null);
  const [inspectingEventName, setInspectingEventName] = useState<string>("");
  const [supportAccessData, setSupportAccessData] = useState<{
    activeSupportAccess: SupportAccessDetails | null;
    registrations: SupportAttendeeRecord[];
  } | null>(null);
  const [isLoadingSupportData, setIsLoadingSupportData] = useState(false);

  async function handleInspect(eventId: string) {
    const ev = events.find((e) => e.id === eventId);
    setInspectingEventId(eventId);
    setInspectingEventName(ev?.name ?? "Event");
    setIsLoadingSupportData(true);

    try {
      const data = await onFetchSupportData(eventId);
      setSupportAccessData({
        activeSupportAccess: data.activeSupportAccess,
        registrations: data.registrations,
      });
    } catch {
      setSupportAccessData({
        activeSupportAccess: null,
        registrations: [],
      });
    } finally {
      setIsLoadingSupportData(false);
    }
  }

  async function handleGrantSupportAccessInView(eventId: string, reason: string) {
    await onGrantSupportAccess(eventId, reason);
    await handleInspect(eventId);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-headline text-foreground">
              Platform Administration
            </h1>
            <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary gap-1">
              <IconShield className="h-3.5 w-3.5" /> Operations Surface
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Command-only operations surface for account suspension, event status management, and audited support access.
          </p>
        </div>

        <Badge variant="secondary" className="self-start sm:self-auto font-mono text-xs">
          Signed in as {adminEmail}
        </Badge>
      </div>

      {inspectingEventId ? (
        isLoadingSupportData ? (
          <div className="p-12 text-center text-sm text-muted-foreground animate-pulse">
            Loading Support access data...
          </div>
        ) : (
          <SupportAccessView
            eventId={inspectingEventId}
            eventName={inspectingEventName}
            activeSupportAccess={supportAccessData?.activeSupportAccess ?? null}
            registrations={supportAccessData?.registrations ?? []}
            onGrantSupportAccess={handleGrantSupportAccessInView}
            onBack={() => {
              setInspectingEventId(null);
              setSupportAccessData(null);
            }}
          />
        )
      ) : (
        <div className="space-y-6">
          <div className="flex border-b">
            <button
              type="button"
              onClick={() => setActiveTab("accounts")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "accounts"
                  ? "border-primary text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconUsers className="h-4 w-4" /> Platform Accounts ({accounts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("events")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === "events"
                  ? "border-primary text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconCalendar className="h-4 w-4" /> Platform Events ({events.length})
            </button>
          </div>

          {activeTab === "accounts" && (
            <AdminAccountsList
              accounts={accounts}
              onSuspend={onSuspendAccount}
              onReactivate={onReactivateAccount}
            />
          )}

          {activeTab === "events" && (
            <AdminEventsList
              events={events}
              onSuspendEvent={onSuspendEvent}
              onReactivateEvent={onReactivateEvent}
              onInspectAttendeeData={handleInspect}
            />
          )}
        </div>
      )}
    </div>
  );
}
