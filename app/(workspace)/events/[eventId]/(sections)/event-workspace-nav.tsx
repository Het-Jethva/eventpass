"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconClockQuestion,
  IconFileSpreadsheet,
  IconForms,
  IconHistory,
  IconLayoutDashboard,
  IconSettings,
  IconUserShield,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";

type EventWorkspaceNavProps = {
  eventId: string;
  eventName: string;
};

export function EventWorkspaceNav({ eventId, eventName }: EventWorkspaceNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Overview",
      href: `/events/${eventId}`,
      exact: true,
      icon: IconLayoutDashboard,
    },
    {
      label: "Registrations",
      href: `/events/${eventId}/registrations`,
      exact: false,
      icon: IconFileSpreadsheet,
    },
    {
      label: "Form",
      href: `/events/${eventId}/form`,
      exact: false,
      icon: IconForms,
    },
    {
      label: "Check-in",
      href: `/events/${eventId}/check-in`,
      exact: false,
      icon: IconClockQuestion,
    },
    {
      label: "Staff",
      href: `/events/${eventId}/staff`,
      exact: false,
      icon: IconUserShield,
    },
    {
      label: "Audit",
      href: `/events/${eventId}/audit`,
      exact: false,
      icon: IconHistory,
    },
    {
      label: "Settings",
      href: `/events/${eventId}/edit`,
      exact: false,
      icon: IconSettings,
    },
  ];

  return (
    <nav
      aria-label={`Event ${eventName} workspace sections`}
      // Seven sections wrap to three rows of pills on a phone, which reads as a
      // block of chrome rather than a navigation bar. Scrolling keeps it to one
      // row and preserves the section order DESIGN.md specifies.
      className="-mx-4 overflow-x-auto border-b px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex w-max items-center gap-1">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
