"use client";

import { useState } from "react";
import { IconCalendar, IconShield, IconUsers } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { AdminAccountsList, type AccountItem } from "./admin-accounts-list";
import { AdminEventsList, type EventItem } from "./admin-events-list";
import {
  SupportAccessView,
  type SupportAccessDetails,
  type SupportAttendeeRecord,
} from "./support-access-view";

const TABS = [
  { id: "accounts", label: "Accounts", icon: IconUsers },
  { id: "events", label: "Events", icon: IconCalendar },
] as const;

interface AdminDashboardProps {
  accounts: AccountItem[];
  events: EventItem[];
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
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      {/* The signed-in address is in the header now, once. */}
      <div className="flex flex-col gap-2 border-b pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-headline">Administration</h1>
          <Badge variant="info">
            <IconShield aria-hidden="true" />
            Platform-wide
          </Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Suspend accounts and events, and open time-limited, recorded access to
          attendee data for support.
        </p>
      </div>

      {inspectingEventId ? (
        isLoadingSupportData ? (
          <div
            className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"
            role="status"
          >
            <Spinner />
            Loading attendee data…
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
        <div className="flex flex-col gap-6">
          {/* A real tablist: arrow keys move between tabs, the panel is named by
              its tab, and the active label does not change weight — which used
              to shift both tabs sideways every time you switched. */}
          <div className="flex border-b" role="tablist" aria-label="Administration sections">
            {TABS.map(({ icon: Icon, id, label }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`admin-tab-${id}`}
                  aria-selected={isActive}
                  aria-controls={`admin-panel-${id}`}
                  tabIndex={isActive ? 0 : -1}
                  onKeyDown={(keyEvent) => {
                    if (keyEvent.key !== "ArrowLeft" && keyEvent.key !== "ArrowRight") return;
                    keyEvent.preventDefault();
                    const next = TABS[
                      (TABS.findIndex((tab) => tab.id === activeTab) +
                        (keyEvent.key === "ArrowRight" ? 1 : TABS.length - 1)) %
                        TABS.length
                    ]!;
                    setActiveTab(next.id);
                    document.getElementById(`admin-tab-${next.id}`)?.focus();
                  }}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                    isActive
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                  <span className="text-muted-foreground tabular-nums">
                    {id === "accounts" ? accounts.length : events.length}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            role="tabpanel"
            id={`admin-panel-${activeTab}`}
            aria-labelledby={`admin-tab-${activeTab}`}
          >
            {activeTab === "accounts" ? (
              <AdminAccountsList
                accounts={accounts}
                onSuspend={onSuspendAccount}
                onReactivate={onReactivateAccount}
              />
            ) : (
              <AdminEventsList
                events={events}
                onSuspendEvent={onSuspendEvent}
                onReactivateEvent={onReactivateEvent}
                onInspectAttendeeData={handleInspect}
              />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
