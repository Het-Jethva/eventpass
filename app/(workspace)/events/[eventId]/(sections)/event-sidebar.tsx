"use client";

import { useEffect, useState, ViewTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconArrowLeft,
  IconClockQuestion,
  IconExternalLink,
  IconFileSpreadsheet,
  IconForms,
  IconHistory,
  IconLayoutDashboard,
  IconMenu2,
  IconScan,
  IconSettings,
  IconUserShield,
  IconX,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Seven sections previously lived in a horizontally scrolling strip with the
// scrollbar deliberately hidden, so on a phone Staff, Audit, and Settings sat
// off-screen with no affordance that they existed. They now all render at once
// in a rail, and the rail collapses to a drawer rather than a scroller.
//
// This also removes two bands of chrome: the standalone back-link and the pill
// nav both fold into the rail, leaving the section's own heading at the top of
// the content column. DESIGN.md § Components.

type EventSidebarProps = {
  eventId: string;
  eventName: string;
  eventSlug: string;
  statusLabel: string;
  statusVariant: "secondary" | "success" | "destructive";
  showScanner: boolean;
  showPublicPage: boolean;
};

function navItems(eventId: string) {
  return [
    { label: "Overview", href: `/events/${eventId}`, exact: true, icon: IconLayoutDashboard },
    { label: "Registrations", href: `/events/${eventId}/registrations`, exact: false, icon: IconFileSpreadsheet },
    { label: "Form", href: `/events/${eventId}/form`, exact: false, icon: IconForms },
    { label: "Check-in", href: `/events/${eventId}/check-in`, exact: false, icon: IconClockQuestion },
    { label: "Staff", href: `/events/${eventId}/staff`, exact: false, icon: IconUserShield },
    { label: "Audit", href: `/events/${eventId}/audit`, exact: false, icon: IconHistory },
    { label: "Settings", href: `/events/${eventId}/edit`, exact: false, icon: IconSettings },
  ];
}

function SidebarBody({
  eventId,
  eventName,
  eventSlug,
  statusLabel,
  statusVariant,
  showScanner,
  showPublicPage,
  onNavigate,
  morph,
}: EventSidebarProps & { onNavigate?: () => void; morph?: boolean }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex flex-col gap-3">
        <Link
          href="/events"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <IconArrowLeft aria-hidden="true" className="size-4" />
          Events
        </Link>
        <div className="flex flex-col gap-1.5">
          {/* Paired with the same name in the Events list. Only the persistent
              rail claims it — the drawer renders the same body, and two live
              elements sharing one view-transition-name is a conflict. */}
          {morph ? (
            <ViewTransition name={`event-${eventId}`}>
              <p className="text-base leading-snug font-medium text-balance">
                {eventName}
              </p>
            </ViewTransition>
          ) : (
            <p className="text-base leading-snug font-medium text-balance">
              {eventName}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant}>{statusLabel}</Badge>
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">
            /e/{eventSlug}
          </p>
        </div>
      </div>

      <nav aria-label={`${eventName} sections`} className="flex flex-col gap-0.5">
        {navItems(eventId).map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {showScanner || showPublicPage ? (
        <div className="mt-auto flex flex-col gap-2 border-t pt-4">
          {showScanner ? (
            <Link
              href={`/scanner/${eventId}`}
              className={buttonVariants({ size: "sm" })}
            >
              <IconScan data-icon="inline-start" />
              Open scanner
            </Link>
          ) : null}
          {showPublicPage ? (
            <Link
              href={`/e/${eventSlug}`}
              target="_blank"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <IconExternalLink data-icon="inline-end" />
              Open public page
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function EventSidebar(props: EventSidebarProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <div className="flex items-center gap-3 border-b bg-sidebar px-4 py-2.5 lg:hidden">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => setOpen(true)}
          aria-label={`Open ${props.eventName} sections`}
          aria-expanded={open}
        >
          <IconMenu2 />
        </Button>
        <span className="min-w-0 truncate text-sm font-medium">
          {props.eventName}
        </span>
      </div>

      <aside className="hidden w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground lg:block">
        <div className="sticky top-0 max-h-svh overflow-y-auto">
          <SidebarBody {...props} morph />
        </div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close sections"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${props.eventName} sections`}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r bg-sidebar text-sidebar-foreground shadow-xl"
          >
            <div className="flex justify-end p-2 pb-0">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(false)}
                aria-label="Close sections"
              >
                <IconX />
              </Button>
            </div>
            {/* Navigating from inside the drawer should not leave it hanging
                open over the page it just loaded. */}
            <SidebarBody {...props} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
